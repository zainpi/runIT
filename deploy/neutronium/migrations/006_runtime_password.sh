#!/bin/sh
set -eu
# Used by the official PostgreSQL initialization entrypoint only. Existing installs
# can run the same SQL as a trusted database owner with this variable exported.
: "${NEUTRONIUM_APP_DATABASE_PASSWORD:?Set a separate application database password}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password NEUTRONIUM_APP_DATABASE_PASSWORD
select format('alter role neutronium_app password %L', :'app_password') \gexec
SQL
