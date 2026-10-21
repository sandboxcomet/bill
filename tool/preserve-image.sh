#!/usr/bin/env bash
# Runs on the CI runner; preserve the active image in the registry before latest changes.
set -Eeuo pipefail
: "${IMAGE_NAME:?}" "${DEPLOY_HOST:?}" "${DEPLOY_PORT:?}" "${DEPLOY_USER:?}"
: "${DEPLOY_ROOT:?}" "${BILL_KNOWN_HOSTS:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}"
[[ "$IMAGE_NAME" =~ ^[a-z0-9._-]+/[a-z0-9._-]+$ ]]
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9.-]+$ && "$DEPLOY_USER" =~ ^[a-zA-Z0-9_-]+$ ]]
[[ "$DEPLOY_PORT" =~ ^[0-9]+$ && "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]]
[[ "$DEPLOY_ROOT" =~ ^/var/opt/[a-zA-Z0-9/_-]+$ && "$DEPLOY_ROOT" != *'/../'* ]]
printf -v args '%q ' "$IMAGE_NAME" "$DEPLOY_ROOT" "${APPROVED_REPLACE_CONTAINER:-}"
source=$(ssh -p "$DEPLOY_PORT" -o BatchMode=yes -o IdentityFile=none \
    -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$BILL_KNOWN_HOSTS" \
    "$DEPLOY_USER@$DEPLOY_HOST" "bash -s -- $args" <<'REMOTE'
set -Eeuo pipefail
repo=$1
root=$2
approved=$3
test -f "$root/shared/.env"
docker info >/dev/null
docker compose version >/dev/null
docker network inspect production >/dev/null
container=$(docker ps --all --filter 'name=^/wonglao-bill$' --no-trunc --format '{{.ID}}')
if [[ -z "$container" ]]; then
    printf 'none\n'
else
    [[ "$approved" == "$container" ]] || { printf "Existing app container %s requires explicit replacement approval before publishing. Run manually with approved_replace_container.\n" "$container" >&2; exit 1; }
    active_id=$(docker container inspect wonglao-bill --format '{{.Image}}')
    docker image inspect "$active_id" --format '{{json .RepoDigests}}' |
        python3 -c 'import json,sys; repo=sys.argv[1]; refs=[r for r in json.load(sys.stdin) or [] if r.startswith(repo+"@sha256:")];
if not refs: raise SystemExit("Cannot preserve deployed image: no matching registry digest")
print(refs[0])' "$repo"
fi
REMOTE
)

inspect_digest() {
    local output
    if output=$(docker buildx imagetools inspect "$1" --format '{{printf "%s" .Manifest.Digest}}' 2>&1); then
        # Avoid the Buildx .Manifest prefix shortcut that prints a human-readable report.
        printf '%s\n' "$output" | python3 -c 'import re,sys; lines=sys.stdin.read().splitlines();
digests=[line.strip() for line in lines if re.fullmatch(r"sha256:[a-f0-9]{64}", line.strip())];
if len(digests)!=1: raise SystemExit("Registry inspection did not return one valid digest")
print(digests[0])'
    else
        printf '%s\n' "$output"
        return 1
    fi
}

if [[ "$source" == none ]]; then
    if previous=$(inspect_digest "$IMAGE_NAME:latest"); then
        source="$IMAGE_NAME@$previous"
    elif [[ "$previous" == *'manifest unknown'* || "$previous" == *'not found'* ]]; then
        echo 'Initial image: no deployed service or previous latest; no backup needed.'
        exit 0
    else
        echo 'Cannot inspect previous latest; refusing to overwrite it.' >&2
        exit 1
    fi
fi
[[ "$source" =~ ^[a-z0-9._-]+/[a-z0-9._-]+@sha256:[a-f0-9]{64}$ ]]
digest=${source##*@}
backup="$IMAGE_NAME:backup-${digest#sha256:}-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
if existing=$(inspect_digest "$backup"); then
    [[ "$existing" == "$digest" ]] || { echo 'Backup tag already belongs to another image.' >&2; exit 1; }
elif [[ "$existing" == *'manifest unknown'* || "$existing" == *'not found'* ]]; then
    docker buildx imagetools create --prefer-index=false --tag "$backup" "$source"
else
    echo 'Cannot prove backup tag is unused; refusing publication.' >&2
    exit 1
fi
actual=$(inspect_digest "$backup")
[[ "$actual" == "$digest" ]] || { printf 'Backup digest verification failed: expected %s, received %s\n' "$digest" "$actual" >&2; exit 1; }
printf 'Preserved %s as %s\n' "$source" "$backup"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf 'Previous image retained as `%s` (digest `%s`).\n\n' "$backup" "$digest" >> "$GITHUB_STEP_SUMMARY"
fi
