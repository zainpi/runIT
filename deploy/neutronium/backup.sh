#!/bin/sh
set -eu
cd "$(dirname "$0")"
umask 077
mkdir -p backups
output="backups/neutronium-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose exec -T db pg_dump -U neutronium -d neutronium -Fc > "$output.tmp"
mv "$output.tmp" "$output"
echo "$output"
