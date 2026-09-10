#!/bin/sh
set -eu
cd "$(dirname "$0")"
umask 077
mkdir -p backups
output="backups/neutronium-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T db pg_dump -U neutronium -d neutronium -Fc > "$output.tmp"
mv "$output.tmp" "$output"
# Pause writers briefly to pair the database snapshot with attachment storage.
# For strict point-in-time snapshots, stop app/scheduler before invoking this script.
docker compose exec -T app tar -C /app/private-files -czf - . > "$output.files.tar.gz.tmp"
mv "$output.files.tar.gz.tmp" "$output.files.tar.gz"
echo "$output"
echo "$output.files.tar.gz"
