#!/usr/bin/env bash
# Streamed over SSH. VM code/config tracked by Git is never modified directly.
set -Eeuo pipefail
umask 077
image=${1:?image required}
release=${2:?release required}
root=${3:?runtime root required}
compose_base64=${4:?compose payload required}
digest=${5:?published digest required}
import_base64=${6:?host database import helper required}
[[ "$image" =~ ^[a-z0-9._-]+/[a-z0-9._-]+:latest$ ]] || exit 1
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 1
[[ "$release" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || exit 1
[[ "$root" =~ ^/var/opt/[a-zA-Z0-9/_-]+$ && "$root" != *'/../'* && "$root" != */.. ]] || exit 1
# Refuse symlinks, tracked paths and nested worktrees before any file mutation.
python3 - "$root" <<'PY'
import os, pathlib, subprocess, sys
p=pathlib.Path(sys.argv[1])
for candidate in [p,*p.parents]:
    if candidate.is_symlink(): raise SystemExit(f'Refusing symlink: {candidate}')
existing=p
while not existing.exists(): existing=existing.parent
probe=subprocess.run(['git','-C',str(existing),'rev-parse','--show-toplevel'],env=dict(os.environ,GIT_DISCOVERY_ACROSS_FILESYSTEM='1'),text=True,capture_output=True)
if probe.returncode == 0:
    repo=pathlib.Path(probe.stdout.strip())
    result=subprocess.run(['git','-C',str(repo),'ls-files','--',str(p.relative_to(repo))],text=True,capture_output=True,check=True)
    if result.stdout: raise SystemExit('Runtime root contains Git-tracked paths; refusing deployment')
elif 'not a git repository' not in probe.stderr:
    raise SystemExit('Cannot prove runtime Git status')
if p.exists():
    for base,dirs,files in os.walk(p,followlinks=False):
        if '.git' in dirs or '.git' in files: raise SystemExit(f'Nested Git worktree: {base}')
        for name in dirs+files:
            if pathlib.Path(base,name).is_symlink(): raise SystemExit(f'Runtime symlink requires manual review: {base}/{name}')
PY

shared="$root/shared"
[[ -f "$shared/.env" ]] || { echo "Provision $shared/.env first (see deployment/README.md)." >&2; exit 1; }
# Validate production configuration without printing secrets.
python3 - "$shared/.env" <<'PYENV'
from pathlib import Path
import re, sys
from urllib.parse import urlsplit
values={}
for line in Path(sys.argv[1]).read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key,value=line.split('=',1); values[key.strip()]=value.strip().strip("\"'")
for key in ['AUTH_SECRET','PAYMENT_LINK_SECRET','EASY_SLIP_KEY','R2_ENDPOINT','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','PAYMENT_R2_BUCKET_NAME','DATABASE_URL']:
    if not values.get(key): raise SystemExit('Missing runtime setting: '+key)
for key in ['AUTH_SECRET','PAYMENT_LINK_SECRET']:
    if len(values[key]) < 32: raise SystemExit('Runtime secret must have at least 32 characters: '+key)
try:
    database=urlsplit(values['DATABASE_URL'])
    valid=database.scheme == 'mysql' and database.hostname == 'host.docker.internal' and database.path == '/wonglao_bill' and database.port in (None,3306) and database.username and database.password and not database.fragment
except ValueError:
    valid=False
if not valid: raise SystemExit('DATABASE_URL must select host MySQL/wonglao_bill with URL-encoded credentials')
if values.get('BILL_DB_IMPORT_FROM_CONTAINER','') not in ('','wonglao-bill-database'): raise SystemExit('Unexpected database import source')
if values.get('AUTH_URL') != 'https://bill.wonglao.com': raise SystemExit('Unexpected AUTH_URL')
providers=[bool(values.get('AUTH_'+p+'_ID') and values.get('AUTH_'+p+'_SECRET')) for p in ['GOOGLE','LINE']]
if not any(providers): raise SystemExit('Configure at least one OAuth provider with production callback URLs')
PYENV

docker network inspect production >/dev/null
[[ ! -e "$root/releases/$release" ]] || { echo 'Release already exists; use a fresh workflow attempt.' >&2; exit 1; }
mkdir -p "$root/releases/$release"
release_dir="$root/releases/$release"
printf '%s' "$compose_base64" | base64 --decode > "$release_dir/compose.yml"
printf '%s' "$import_base64" | base64 --decode > "$release_dir/migrate-host-mysql.py"
export BILL_IMAGE="$image" BILL_RUNTIME_DIR="$shared"
compose=(docker compose --env-file "$shared/.env" --project-name wonglao-bill --file "$release_dir/compose.yml")
"${compose[@]}" config --quiet
"${compose[@]}" pull app
expected_id=$(docker image inspect "$image" --format '{{.Id}}')
docker image inspect "$image" --format '{{json .RepoDigests}}' |
    python3 -c 'import json,sys; refs=json.load(sys.stdin) or []; expected=sys.argv[1]+"@"+sys.argv[2];
if expected not in refs: raise SystemExit("Refreshed latest does not match this workflow build")' "${image%:latest}" "$digest"

# Retain the old database container/volume. Import once into an empty host schema
# only when explicitly requested; verify every row before starting the new app.
previous_app=$(docker ps --all --filter 'name=^/wonglao-bill$' --no-trunc --format '{{.ID}}')
previous_running=$(docker inspect "$previous_app" --format '{{.State.Running}}' 2>/dev/null || true)
resume_previous_on_error() {
    if [[ "$previous_running" == true && "$(docker ps --all --filter 'name=^/wonglao-bill$' --no-trunc --format '{{.ID}}')" == "$previous_app" ]]; then
        docker start "$previous_app" >/dev/null || true
    fi
}
trap resume_previous_on_error ERR
python3 "$release_dir/migrate-host-mysql.py" "$shared/.env"
# All current migrations are additive. Retain the migration container for review.
"${compose[@]}" run --no-deps --rm=false --name "wonglao-bill-migrate-$release" -T app \
    node node_modules/prisma/build/index.js migrate deploy </dev/null
"${compose[@]}" up --detach --no-deps --wait --wait-timeout 180 app
actual_id=$(docker container inspect wonglao-bill --format '{{.Image}}')
actual_ref=$(docker container inspect wonglao-bill --format '{{.Config.Image}}')
[[ "$actual_id" == "$expected_id" && "$actual_ref" == "$image" ]] || { echo 'Running image verification failed.' >&2; exit 1; }
trap - ERR
printf 'BILL_IMAGE=%s\nBILL_IMAGE_DIGEST=%s\nBILL_RUNTIME_DIR=%s\n' "$image" "$digest" "$shared" > "$release_dir/release.env"
printf '%s\n' "$release" > "$root/current-release"
docker inspect wonglao-bill --format 'Image={{.Config.Image}} ID={{.Image}} Health={{.State.Health.Status}}'
echo 'Application healthy; image digest and ID verified. Verify public DNS/TLS separately.'
