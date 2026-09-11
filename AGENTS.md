# Neutronium deployment instructions

This repository contains the Neutronium application and its VPS deployment. The
following runbook is the default for a user request such as “push Neutronium,”
“update the VPS,” or “deploy the latest Neutronium code.” It is an operational
instruction for this repository; it is separate from product/specification
documents.

Work locally by default. Only perform the remote procedure when the user
explicitly asks to push, update the VPS, deploy, or otherwise publish the
current changes. A previous deployment request does not authorize later
releases. Local implementation, fixes, testing, and “keep going” requests do
not imply a VPS deployment. Do not upload source or start remote builds while
working locally; wait for the user's explicit push request.

## Production target

- Host: `root@165.22.236.188` (DNS: `neutronium.runsit.ca`)
- Remote checkout: `/opt/neutronium`
- Compose directory: `/opt/neutronium/deploy/neutronium`
- Compose project: `neutronium`
- Services: `app`, `db`, `scheduler`, and `proxy`
- Persistent data: Docker volumes `neutronium_postgres` and
  `neutronium_private_files`

Use SSH key authentication already configured on the workstation. Do not put
the VPS secrets, `.env` contents, database passwords, Microsoft credentials,
email credentials, or encryption keys in commits, command output, chat, or
source archives.

If the requested target differs from the host above, stop and resolve the
target before changing anything. Confirm the host is still the Neutronium VPS
with a read-only check such as:

```sh
dig +short neutronium.runsit.ca A
ssh -o BatchMode=yes root@165.22.236.188 'hostname; docker compose ls'
```

## Standard push procedure

Run local tests before the push. At minimum, from the repository root:

```sh
npm run test:neutronium
npm run lint
npx tsc --noEmit
npm run build
```

1. Take a remote backup before uploading or migrating anything. The backup
   includes the PostgreSQL dump and the private-files volume. Keep the output
   paths for the deployment report.

   ```sh
   ssh root@165.22.236.188 \
     'cd /opt/neutronium/deploy/neutronium && ./backup.sh'
   ```

   Also create a rollback archive of the current remote source, excluding
   secrets and backups:

   ```sh
   ssh root@165.22.236.188 'set -eu; umask 077; cd /opt/neutronium; stamp=$(date -u +%Y%m%dT%H%M%SZ); tar --exclude=".env" --exclude=".env.*" --exclude=".dev.vars*" --exclude="*.pem" --exclude="bootstrap-credentials.txt" --exclude="backups" --exclude="node_modules" --exclude=".next*" --exclude=".neutronium-dev" --exclude=".open-next" --exclude=".wrangler" --exclude=".git" -czf /opt/neutronium-source-$stamp.tar.gz .; echo /opt/neutronium-source-$stamp.tar.gz'
   ```

2. Preserve the remote `deploy/neutronium/.env`. If the separate runtime
   password is missing, generate it on the VPS and append it without printing
   the value:

   ```sh
   ssh root@165.22.236.188 'set -eu; cd /opt/neutronium/deploy/neutronium; if ! grep -q "^NEUTRONIUM_APP_DATABASE_PASSWORD=" .env; then printf "NEUTRONIUM_APP_DATABASE_PASSWORD=%s\n" "$(openssl rand -hex 32)" >> .env; chmod 600 .env; fi'
   ```

3. Upload the working tree with `rsync`, excluding Git state, local builds,
   development data, backups, and the remote secrets file:

   If other applications or simultaneous tasks have unrelated changes, scope
   the upload to the reviewed Neutronium files with `rsync -azR` instead of
   uploading the whole repository. Include shared configuration or dependency
   files only when they belong to this release. Record the uploaded scope in
   the release report; preserve unrelated local edits.

   ```sh
   rsync -az \
     --exclude='.git/' \
     --exclude='node_modules/' \
     --exclude='.next/' \
     --exclude='.next-*' \
     --exclude='.neutronium-dev/' \
     --exclude='.env' \
     --exclude='.env.*' \
     --exclude='.dev.vars*' \
     --exclude='.open-next/' \
     --exclude='.wrangler/' \
     --exclude='*.pem' \
     --exclude='*.tsbuildinfo' \
     --exclude='.DS_Store' \
     --exclude='deploy/neutronium/backups/' \
     --exclude='bootstrap-credentials.txt' \
     ./ root@165.22.236.188:/opt/neutronium/
   ```

4. Validate the Compose configuration on the VPS. Never use `docker compose
   down -v`; it deletes production volumes.

   ```sh
   ssh root@165.22.236.188 'cd /opt/neutronium/deploy/neutronium && docker compose config --quiet'
   ```

5. Apply numbered migrations only when their objects are absent, in numeric
   order, after the backup. Migrations are one-time changes and must not be
   blindly rerun:

   ```sh
   ssh root@165.22.236.188 'cd /opt/neutronium/deploy/neutronium && docker compose exec -T db psql -U neutronium -d neutronium -Atc "select to_regclass('"'"'neutronium_help_requests'"'"'),to_regclass('"'"'neutronium_mfa'"'"');"'
   ```

   Apply each missing migration once. The guards below prevent rerunning a
   completed migration; if a migration is partially present, stop and inspect
   it rather than guessing:

   ```sh
   ssh root@165.22.236.188 'set -eu; cd /opt/neutronium/deploy/neutronium; if ! docker compose exec -T db psql -U neutronium -d neutronium -Atc "select to_regclass('"'"'neutronium_help_requests'"'"')" | grep -q neutronium_help_requests; then docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/003_pilot.sql; fi; if ! docker compose exec -T db psql -U neutronium -d neutronium -Atc "select to_regclass('"'"'neutronium_mfa'"'"')" | grep -q neutronium_mfa; then docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/004_mfa.sql; fi; if ! docker compose exec -T db psql -U neutronium -d neutronium -Atc "select 1 from pg_roles where rolname='"'"'neutronium_runtime'"'"'" | grep -q 1; then docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/005_runtime_rls.sql; fi'
   ```

   For the employee invitation/review flow, apply migration 007 before starting
   the updated app. It adds two tenant-scoped tables and the authentication
   return path; it does not change existing employees or memberships. Check all
   three objects so a partial migration is not mistaken for a completed one:

   ```sh
   ssh root@165.22.236.188 'sh -s' <<'REMOTE'
   set -eu
   cd /opt/neutronium/deploy/neutronium
   migration_state=$(docker compose exec -T db psql -U neutronium -d neutronium -Atc "select (to_regclass('neutronium_onboarding_links') is not null)::int + (to_regclass('neutronium_employee_applications') is not null)::int + (exists(select 1 from information_schema.columns where table_schema='public' and table_name='neutronium_auth_tokens' and column_name='return_to'))::int")
   case "$migration_state" in
     0) docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/007_employee_applications.sql ;;
     3) echo 'Migration 007 already applied' ;;
     *) echo 'Partial migration 007 detected; inspect before continuing'; exit 1 ;;
   esac
   REMOTE
   ```

   On initial setup or a password rotation, ensure the runtime role password is installed. Skip this for ordinary releases with an unchanged password. The password is passed to
   the one-off command from the protected `.env` and is never echoed:

   ```sh
   ssh root@165.22.236.188 'set -eu; cd /opt/neutronium/deploy/neutronium; app_password=$(awk -F= '\''$1=="NEUTRONIUM_APP_DATABASE_PASSWORD"{print substr($0,index($0,"=")+1)}'\'' .env); test "${#app_password}" -ge 32; docker compose exec -T -e NEUTRONIUM_APP_DATABASE_PASSWORD="$app_password" db sh /docker-entrypoint-initdb.d/006_runtime_password.sh'
   ```

6. Build and replace the app container. Compose may recreate the database
   container when its environment changes; this is safe only because the
   persistent database volume is preserved and the backup has completed.

   The low-memory standalone Docker build skips TypeScript and lint checks.
   Passing the image build alone is insufficient: those checks must have passed
   separately for the released source. If local resource pressure prevents
   completion, validate the same uploaded source in an isolated build-stage
   container before rollout, without production secrets or network access.

   ```sh
   ssh root@165.22.236.188 'cd /opt/neutronium/deploy/neutronium && docker compose up -d --build app'
   ```

   The scheduler uses the mounted `scheduler.mjs`; restart it if that file or
   its environment changed:

   ```sh
   ssh root@165.22.236.188 'cd /opt/neutronium/deploy/neutronium && docker compose up -d --force-recreate scheduler'
   ```

   If `Caddyfile` changed, validate the uploaded file before replacing the
   proxy. Recreating the proxy refreshes its single-file bind mount after
   rsync replaces the file:

   ```sh
   ssh root@165.22.236.188 'set -eu; cd /opt/neutronium/deploy/neutronium; docker compose run --rm --no-deps proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; docker compose up -d --no-deps --force-recreate proxy'
   ```

   Keep both `/neutronium` and `/neutronium/*` in the proxy matcher. Next.js
   adds the trailing slash while preserving query parameters; rejecting the
   bare path breaks older email links. Application redirects and navigation
   should use `/neutronium/` before query parameters.

7. Verify the rollout before reporting success:

   ```sh
   ssh root@165.22.236.188 'set -eu; cd /opt/neutronium/deploy/neutronium; sleep 10; docker compose ps; test "$(docker inspect --format "{{.State.Health.Status}}" neutronium-app-1)" = healthy; test "$(docker inspect --format "{{.State.Health.Status}}" neutronium-db-1)" = healthy; test "$(curl -fsS --max-time 10 http://127.0.0.1:3000/neutronium/api/config/ | grep -c '"demoAvailable":false')" -eq 1; test "$(docker compose logs --since=90s scheduler 2>&1 | grep -c failed || true)" -eq 0'
   curl -fsS --max-time 15 https://neutronium.runsit.ca/neutronium/api/config/ | python3 -c 'import json,sys; v=json.load(sys.stdin); assert v["demoAvailable"] is False; print("public Neutronium health OK")'
   curl -fsS -L --max-time 15 -o /dev/null -w '%{http_code} %{url_effective}\n' 'https://neutronium.runsit.ca/neutronium?view=profile'
   ```

   The last check must return HTTP 200 at `/neutronium/?view=profile`. Use
   synthetic invalid tokens to test confirmation errors. Never consume a real
   invitation or confirmation link supplied by the user for a smoke test.

8. If migration 003 moved legacy inline attachments and the database contains
   any, run the restartable private-file backfill described in
   `docs/neutronium-pilot.md` from a trusted checkout with the production
   database, keyring, and private-files configuration. Do not delete inline
   data until the new files have been verified. If the help-request count is
   zero, there is nothing to backfill.

## Failure and rollback

If the image build fails, the existing app container remains in place. Inspect
`docker compose logs --tail=100 app` and fix the source before retrying. If the
new container is unhealthy or the public check fails, inspect logs and restore
the previous source archive plus the matching database/private-files backup.
Restore the application, database, private files, and encryption keyring as a
matched set. Do not run the previous application against post-migration data
without restoring the pre-migration database. Never remove production volumes
as a deployment workaround.

Report the target, backup paths, migrations applied or skipped, image/build
result, container health, public health result, and any remaining external
validation (Microsoft consent, email delivery, or customer workflows). Do not
claim live-provider validation from local tests or a health endpoint alone.

## Useful read-only checks

```sh
ssh root@165.22.236.188 'cd /opt/neutronium/deploy/neutronium && docker compose ps && docker compose logs --tail=100 app scheduler proxy'
ssh root@165.22.236.188 'cd /opt/neutronium/deploy/neutronium && docker compose exec -T db psql -U neutronium -d neutronium -Atc "select count(*) from neutronium_organizations; select count(*) from neutronium_help_requests; select count(*) from neutronium_mfa;"'
curl -fsS https://neutronium.runsit.ca/neutronium/api/config/
```
