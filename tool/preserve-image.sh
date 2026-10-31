#!/usr/bin/env bash
# Runs on the CI runner; preserve the active image in the registry before latest changes.
set -Eeuo pipefail
: "${IMAGE_NAME:?}" "${DEPLOY_HOST:?}" "${DEPLOY_PORT:?}" "${DEPLOY_USER:?}"
: "${DEPLOY_ROOT:?}" "${BILL_KNOWN_HOSTS:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}"
[[ "$IMAGE_NAME" =~ ^[a-z0-9._-]+/[a-z0-9._-]+$ ]]
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9.-]+$ && "$DEPLOY_USER" =~ ^[a-zA-Z0-9_-]+$ ]]
[[ "$DEPLOY_PORT" =~ ^[0-9]+$ && "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]]
[[ "$DEPLOY_ROOT" =~ ^/var/opt/[a-zA-Z0-9/_-]+$ && "$DEPLOY_ROOT" != *'/../'* ]]
printf -v args '%q ' "$IMAGE_NAME" "$DEPLOY_ROOT"
active=$(ssh -p "$DEPLOY_PORT" -o BatchMode=yes -o IdentityFile=none \
    -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$BILL_KNOWN_HOSTS" \
    "$DEPLOY_USER@$DEPLOY_HOST" "bash -s -- $args" <<'REMOTE'
set -Eeuo pipefail
repo=$1
root=$2
test -f "$root/shared/.env"
docker info >/dev/null
docker compose version >/dev/null
docker network inspect production >/dev/null
container=$(docker ps --all --filter 'name=^/wonglao-bill$' --no-trunc --format '{{.ID}}')
if [[ -z "$container" ]]; then
    printf 'none\n'
else
    active_id=$(docker container inspect wonglao-bill --format '{{.Image}}')
    docker image inspect "$active_id" --format '{{json .RepoDigests}}' |
        python3 -c 'import json,sys; repo,active_id=sys.argv[1:]; refs=[r for r in json.load(sys.stdin) or [] if r.startswith(repo+"@sha256:")];
print(active_id, refs[0] if refs else "none")' "$repo" "$active_id"
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

source=none
active_id=none
if [[ "$active" != none ]]; then
    read -r active_id source <<< "$active"
    [[ "$active_id" =~ ^sha256:[a-f0-9]{64}$ ]]
    [[ "$source" == none || "$source" =~ ^[a-z0-9._-]+/[a-z0-9._-]+@sha256:[a-f0-9]{64}$ ]]
fi

if [[ "$active_id" == none ]]; then
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

# The registry can lose the deployed manifest while the VM still has its image.
# Only a definite missing manifest permits recovery; auth/network errors fail closed.
recover_from_vm=false
if [[ "$active_id" != none ]]; then
    if [[ "$source" == none ]]; then
        recover_from_vm=true
    elif registry_digest=$(inspect_digest "$source"); then
        [[ "$registry_digest" == "${source##*@}" ]] || { echo 'Active registry digest mismatch.' >&2; exit 1; }
    elif [[ "$registry_digest" == *'manifest unknown'* || "$registry_digest" == *'not found'* ]]; then
        recover_from_vm=true
    else
        echo 'Cannot inspect deployed image in registry; refusing publication.' >&2
        exit 1
    fi
fi

if [[ "$recover_from_vm" == true ]]; then
    backup="$IMAGE_NAME:backup-${active_id#sha256:}-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
    if existing=$(inspect_digest "$backup"); then
        docker pull "$backup" >/dev/null
        [[ "$(docker image inspect "$backup" --format '{{.Id}}')" == "$active_id" ]] || { echo 'Backup tag already belongs to another image.' >&2; exit 1; }
    elif [[ "$existing" == *'manifest unknown'* || "$existing" == *'not found'* ]]; then
        printf -v save_args '%q ' "$active_id"
        ssh -p "$DEPLOY_PORT" -o BatchMode=yes -o IdentityFile=none \
            -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$BILL_KNOWN_HOSTS" \
            "$DEPLOY_USER@$DEPLOY_HOST" "bash -s -- $save_args" <<'REMOTE' | docker image load
set -Eeuo pipefail
expected=$1
[[ "$(docker container inspect wonglao-bill --format '{{.Image}}')" == "$expected" ]] || { echo 'Deployed image changed before backup.' >&2; exit 1; }
docker image save "$expected"
REMOTE
        [[ "$(docker image inspect "$active_id" --format '{{.Id}}')" == "$active_id" ]]
        docker tag "$active_id" "$backup"
        docker push "$backup"
        docker pull "$backup" >/dev/null
        [[ "$(docker image inspect "$backup" --format '{{.Id}}')" == "$active_id" ]] || { echo 'Restored backup image ID mismatch.' >&2; exit 1; }
    else
        echo 'Cannot prove backup tag is unused; refusing publication.' >&2
        exit 1
    fi
    digest=$(inspect_digest "$backup")
    printf 'Preserved VM image %s as %s (registry digest %s)\n' "$active_id" "$backup" "$digest"
    if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
        printf 'Previous VM image `%s` retained as `%s` (digest `%s`).\n\n' "$active_id" "$backup" "$digest" >> "$GITHUB_STEP_SUMMARY"
    fi
    exit 0
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
