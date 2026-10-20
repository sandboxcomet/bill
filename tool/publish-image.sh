#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repository="${1:?Usage: bash tool/publish-image.sh image-repository}"
[[ "$repository" =~ ^[a-z0-9][a-z0-9./_-]+$ && "$repository" != *@* && "${repository##*/}" != *:* ]] || { echo 'Supply the repository without a tag' >&2; exit 1; }
previous="${PREVIOUS_IMAGE:-$repository:latest}"
if docker pull "$previous"; then
  previous_id=$(docker image inspect "$previous" --format '{{.Id}}')
else
  [[ "${CONFIRMED_NO_PREVIOUS_IMAGE:-0}" == 1 ]] || { echo 'Cannot preserve the previous image; verify registry access or confirm the initial publication.' >&2; exit 1; }
  previous_id=$(docker image inspect "$repository:latest" --format '{{.Id}}' 2>/dev/null || true)
fi
if [[ -n "$previous_id" ]]; then
  backup="$repository:backup-${previous_id#sha256:}-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
  docker tag "$previous_id" "$backup"
  docker push "$backup"
  printf 'Preserved rollback tag: %s\n' "$backup"
fi
docker build --platform "${IMAGE_PLATFORM:-linux/amd64}" --tag "$repository:latest" .
docker push "$repository:latest"
