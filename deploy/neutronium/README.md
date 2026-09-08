# Neutronium on a VPS

Requirements: Ubuntu with Docker Engine and Compose v2, an A record pointing to the VPS, ports 80/443 open. PostgreSQL is not exposed publicly. Only Neutronium and its Next.js assets are routed through this deployment. A 512 MB VPS needs swap and is suitable only for a small trial; measure memory under real usage before onboarding companies.

From the repository root:

```sh
cp .env.neutronium.example deploy/neutronium/.env
chmod 600 deploy/neutronium/.env
# Edit that file. Use a hex database password so the composed URL is valid.
openssl rand -hex 32 # database password
openssl rand -hex 32 # separate scheduler secret
openssl rand -base64 32 # encryption key
cd deploy/neutronium
docker compose up -d --build
```

Set `NEUTRONIUM_DOMAIN` (hostname only) and `NEUTRONIUM_APP_URL` (HTTPS origin). Caddy obtains and renews TLS certificates when DNS resolves to the VPS. `NEUTRONIUM_EMAIL_API_KEY` and `NEUTRONIUM_EMAIL_FROM` configure Resend for signup and invitations. The sender domain must be verified with Resend. Microsoft credentials are needed only for the live Microsoft integration. The Docker runtime overrides `NEUTRONIUM_DATABASE_URL` to use its private database service.

The initial SQL migration runs automatically on an empty database volume. Never delete the volume to apply an upgrade. Future numbered SQL migrations must be applied explicitly with `docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/NEW.sql`, after a backup. The app is the dedicated database owner; do not give its credentials to browser clients or unrelated apps.

## First account without email delivery

```sh
docker compose cp bootstrap-account.mjs app:/app/bootstrap-account.mjs
umask 077
docker compose exec -T app node /app/bootstrap-account.mjs owner@example.com > bootstrap-credentials.txt
```

This creates a verified account only if the email is new. Sign in, create your organization, and change the generated password in My profile. It does not overwrite existing passwords. Keep the credential file private and remove it after changing the password.

## Operations

```sh
docker compose ps
docker compose logs --tail=100 app scheduler proxy
./backup.sh
# After uploading updated source:
docker compose up -d --build app
```

Backups are custom-format PostgreSQL dumps in `backups/`. Copy them off the VPS and back up `.env` securely as well: encrypted Microsoft credentials require its keyring. Restore a dump into an empty replacement database with `pg_restore --no-owner -U neutronium -d neutronium`. Verify a restore before relying on backups. `docker compose down` preserves volumes; `down -v` deletes production data and must not be used for updates.

Public health check: `/neutronium/api/config/`. Scheduler errors are logged; the authenticated worker endpoint returns non-2xx if any organization fails. Sessions and tokens expire at read time; periodically remove expired rows from `neutronium_sessions` and `neutronium_auth_tokens` and old rate-limit windows.

## Existing Supabase data

This deployment initializes an empty Neutronium database. It does not copy or delete existing Supabase data. If a production workspace already exists, stop writes, export only its `neutronium_*` table data, and import into a separately tested VPS database. First import user IDs/emails into `neutronium_users`, preserving UUIDs so membership foreign keys remain valid. Supabase passwords and sessions are not compatible with this authentication system; issue fresh invitations with password setup. Preserve the existing encryption keyring for provider credentials. Validate tenant counts, memberships, audit events and workflows before DNS cutover. Keep the original database as a rollback source.

The historical migration under `supabase/migrations` remains for existing installations; new VPS installations use `deploy/neutronium/migrations` exclusively.
