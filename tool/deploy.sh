#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Run from an already updated authoritative checkout. No file writes or Git resets.
existing=$(docker compose ps -aq app)
if [[ -n "$existing" && "${APPROVED_REPLACE_CONTAINER:-}" != "$existing" ]]; then
  printf 'Updating this service would replace existing container %s. Obtain explicit deletion approval for that exact target before setting APPROVED_REPLACE_CONTAINER.
' "$existing" >&2
  exit 1
fi
docker compose --profile production pull app
# DATABASE_URL/CONTAINER_DATABASE_URL select the existing host database.
# Keep the legacy database container and its volume intact; never recreate it.
docker compose --profile production run --no-deps --rm=false app node node_modules/prisma/build/index.js migrate deploy
docker compose --profile production up -d --no-deps app
running=$(docker compose ps -q app)
actual=$(docker inspect "$running" --format '{{.Image}}')
reference=$(docker inspect "$running" --format '{{.Config.Image}}')
[[ "$reference" == *:latest ]] || { echo 'Active application image must use latest' >&2; exit 1; }
expected=$(docker image inspect "$reference" --format '{{.Id}}')
[[ "$actual" == "$expected" ]] || { echo 'Running service does not use the refreshed latest image' >&2; exit 1; }
printf 'Running image: %s\n' "$actual"
curl --fail --retry 12 --retry-delay 3 --retry-all-errors http://127.0.0.1:3002/api/health
