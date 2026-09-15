#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy the current working tree to the configured Neutronium VPS.
# This uploads uncommitted changes too, while excluding secrets, dependencies,
# build output, and backups.

REMOTE_USER="root"
REMOTE_HOST="165.22.236.188"
REMOTE_DOMAIN="neutronium.runsit.ca"
REMOTE="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_ROOT="/opt/neutronium"
REMOTE_COMPOSE_DIR="${REMOTE_ROOT}/deploy/neutronium"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
CONFIRMED=false

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  printf 'Usage: %s [--yes]\n' "$0"
  printf '  --yes  skip the interactive production confirmation\n'
}

case "${1:-}" in
  "") ;;
  --yes) CONFIRMED=true ;;
  *) usage >&2; exit 2 ;;
esac

for command_name in dig ssh rsync npm npx curl python3; do
  command -v "$command_name" >/dev/null 2>&1 ||
    die "Required command is not installed: ${command_name}"
done

if [[ "$CONFIRMED" != true ]]; then
  [[ -t 0 ]] || die "Run interactively or pass --yes to confirm the VPS deployment."
  printf 'This will deploy the current working tree to %s. Type DEPLOY to continue: ' "$REMOTE_DOMAIN"
  read -r confirmation
  [[ "$confirmation" == DEPLOY ]] || die "Deployment cancelled."
fi

cd "$REPO_ROOT"

printf '\n== Local validation ==\n'
npm run test:neutronium
npm run lint
npx tsc --noEmit
npm run build

printf '\n== Remote preflight ==\n'
resolved_ips="$(dig +short "$REMOTE_DOMAIN" A)"
printf 'DNS: %s -> %s\n' "$REMOTE_DOMAIN" "$(printf '%s' "$resolved_ips" | tr '\n' ' ')"
printf '%s\n' "$resolved_ips" | grep -Fxq "$REMOTE_HOST" ||
  die "${REMOTE_DOMAIN} does not resolve to the configured Neutronium VPS ${REMOTE_HOST}."

SSH=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$REMOTE")
"${SSH[@]}" "set -eu; test -f '${REMOTE_COMPOSE_DIR}/.env'; test -x '${REMOTE_COMPOSE_DIR}/backup.sh'; hostname"

printf '\n== Preserve remote runtime configuration ==\n'
"${SSH[@]}" 'set -eu; cd /opt/neutronium/deploy/neutronium; if ! grep -q "^NEUTRONIUM_APP_DATABASE_PASSWORD=" .env; then printf "NEUTRONIUM_APP_DATABASE_PASSWORD=%s\\n" "$(openssl rand -hex 32)" >> .env; fi; chmod 600 .env'

"${SSH[@]}" "set -eu; cd '${REMOTE_COMPOSE_DIR}'; docker compose ls"

printf '\n== Remote backup ==\n'
backup_paths="$("${SSH[@]}" "cd '${REMOTE_COMPOSE_DIR}' && ./backup.sh")"
printf '%s\n' "$backup_paths"

rollback_archive="$("${SSH[@]}" 'set -eu; umask 077; cd /opt/neutronium; stamp=$(date -u +%Y%m%dT%H%M%SZ); tar --exclude=".env" --exclude=".env.*" --exclude=".dev.vars*" --exclude="*.pem" --exclude="bootstrap-credentials.txt" --exclude="backups" --exclude="node_modules" --exclude=".next*" --exclude=".neutronium-dev" --exclude=".open-next" --exclude=".wrangler" --exclude=".git" -czf "/opt/neutronium-source-$stamp.tar.gz" .; echo "/opt/neutronium-source-$stamp.tar.gz"')"
printf 'Rollback source archive: %s\n' "$rollback_archive"

printf '\n== Upload working tree ==\n'
rsync -az \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='.next-*' \
  --exclude='.neutronium-dev/' \
  --exclude='test-results/' \
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
  "$REPO_ROOT/" "$REMOTE:${REMOTE_ROOT}/"

printf '\n== Remote configuration and migrations ==\n'
"${SSH[@]}" 'sh -s' <<'REMOTE_SCRIPT'
set -eu
cd /opt/neutronium/deploy/neutronium

docker compose config --quiet

pilot_state=$(docker compose exec -T db psql -U neutronium -d neutronium -Atc "select (to_regclass('neutronium_help_requests') is not null)::int")
case "$pilot_state" in
  0) docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/003_pilot.sql; echo 'Applied migration 003' ;;
  1) echo 'Migration 003 already applied' ;;
  *) echo 'Partial migration 003 detected; inspect before continuing' >&2; exit 1 ;;
esac

mfa_state=$(docker compose exec -T db psql -U neutronium -d neutronium -Atc "select (to_regclass('neutronium_mfa') is not null)::int")
case "$mfa_state" in
  0) docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/004_mfa.sql; echo 'Applied migration 004' ;;
  1) echo 'Migration 004 already applied' ;;
  *) echo 'Partial migration 004 detected; inspect before continuing' >&2; exit 1 ;;
esac

runtime_state=$(docker compose exec -T db psql -U neutronium -d neutronium -Atc "select (exists(select 1 from pg_roles where rolname='neutronium_runtime'))::int")
case "$runtime_state" in
  0) docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/005_runtime_rls.sql; echo 'Applied migration 005' ;;
  1) echo 'Migration 005 already applied' ;;
  *) echo 'Partial migration 005 detected; inspect before continuing' >&2; exit 1 ;;
esac

application_state=$(docker compose exec -T db psql -U neutronium -d neutronium -Atc "select (to_regclass('neutronium_onboarding_links') is not null)::int + (to_regclass('neutronium_employee_applications') is not null)::int + (exists(select 1 from information_schema.columns where table_schema='public' and table_name='neutronium_auth_tokens' and column_name='return_to'))::int")
case "$application_state" in
  0) docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/007_employee_applications.sql; echo 'Applied migration 007' ;;
  3) echo 'Migration 007 already applied' ;;
  *) echo 'Partial migration 007 detected; inspect before continuing' >&2; exit 1 ;;
esac

review_state=$(docker compose exec -T db psql -U neutronium -d neutronium -Atc "select (select count(*) from information_schema.columns where table_schema='public' and table_name='neutronium_employee_applications' and column_name in ('contact_email','revision','submitted_by')) + (select count(*) from pg_constraint where conrelid='neutronium_employee_applications'::regclass and conname in ('neutronium_application_status','neutronium_application_identity','neutronium_application_decision'))")
case "$review_state" in
  0) docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/008_application_review.sql; echo 'Applied migration 008' ;;
  6) echo 'Migration 008 already applied' ;;
  *) echo 'Partial migration 008 detected; inspect before continuing' >&2; exit 1 ;;
esac

recovery_state=$(docker compose exec -T db psql -U neutronium -d neutronium -Atc "select (exists(select 1 from information_schema.columns where table_schema='public' and table_name='neutronium_onboarding_links' and column_name='token_ciphertext'))::int + (exists(select 1 from information_schema.columns where table_schema='public' and table_name='neutronium_onboarding_links' and column_name='token_key_version'))::int")
case "$recovery_state" in
  0) docker compose exec -T db psql -v ON_ERROR_STOP=1 -U neutronium -d neutronium < migrations/009_invitation_link_recovery.sql; echo 'Applied migration 009' ;;
  2) echo 'Migration 009 already applied' ;;
  *) echo 'Partial migration 009 detected; inspect before continuing' >&2; exit 1 ;;
esac

app_password=$(awk -F= '$1=="NEUTRONIUM_APP_DATABASE_PASSWORD"{print substr($0,index($0,"=")+1)}' .env)
test "${#app_password}" -ge 32
docker compose exec -T -e NEUTRONIUM_APP_DATABASE_PASSWORD="$app_password" db sh /docker-entrypoint-initdb.d/006_runtime_password.sh >/dev/null
unset app_password

echo 'Compose configuration and migrations are ready.'
REMOTE_SCRIPT

printf '\n== Build and replace services ==\n'
"${SSH[@]}" "cd '${REMOTE_COMPOSE_DIR}' && docker compose up -d --build app && docker compose up -d --force-recreate scheduler && docker compose run --rm --no-deps proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && docker compose up -d --no-deps --force-recreate proxy"

printf '\n== Remote health checks ==\n'
"${SSH[@]}" 'sh -s' <<'REMOTE_SCRIPT'
set -eu
cd /opt/neutronium/deploy/neutronium
sleep 10
docker compose ps
test "$(docker inspect --format '{{.State.Health.Status}}' neutronium-app-1)" = healthy
test "$(docker inspect --format '{{.State.Health.Status}}' neutronium-db-1)" = healthy
curl -fsS --max-time 10 http://127.0.0.1:3000/neutronium/api/config/ | python3 -c 'import json,sys; assert json.load(sys.stdin)["demoAvailable"] is False'
test "$(docker compose logs --since=90s scheduler 2>&1 | grep -c failed || true)" -eq 0
echo 'VPS-local health checks passed.'
REMOTE_SCRIPT

public_config="$(curl -fsS --max-time 15 "https://${REMOTE_DOMAIN}/neutronium/api/config/")"
printf '%s' "$public_config" | python3 -c 'import json,sys; v=json.load(sys.stdin); assert v["demoAvailable"] is False; print("Public Neutronium health OK")'
profile_result="$(curl -fsS -L --max-time 15 -o /dev/null -w '%{http_code} %{url_effective}\n' "https://${REMOTE_DOMAIN}/neutronium?view=profile")"
printf 'Profile URL check: %s' "$profile_result"
[[ "$profile_result" == "200 https://${REMOTE_DOMAIN}/neutronium/?view=profile" ]] ||
  die "The public profile URL did not resolve to the expected slash URL."

printf '\nDeployment complete.\nTarget: %s\nBackups: %s\nRollback source: %s\n' "$REMOTE" "$backup_paths" "$rollback_archive"
