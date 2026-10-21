# GitHub Actions deployment — bill.wonglao.com

Uses the ESS pattern: GitHub-hosted `ubuntu-latest` runner, exact GitHub revision streamed into an isolated Docker context, Docker Hub publication, then SSH deployment. Runs on pushes to `main` and manual dispatch from `main`; production runs are serialized.

Application image: `sandboxcomet/wonglao-bill:latest`. The previous deployed digest (or registry latest if no service exists) is backed up under a unique digest/run/attempt tag before publishing. Initial publication is allowed only when the VM has no app and the registry explicitly reports no previous image. Registry/network/auth errors stop publication. Build runs production compilation, ESLint and TypeScript checks. No runtime secrets enter the build context.

## Repository setup

The dedicated repository is `https://github.com/sandboxcomet/bill.git`. The standard GitHub runner is used; set these secrets. Values may use the same deployment host as ESS, but keep the secret names below separate.

| Secret | Purpose |
| --- | --- |
| `BILL_DEPLOY_HOST` | Destination VM hostname/IP |
| `BILL_DEPLOY_PORT` | SSH port |
| `BILL_DEPLOY_USER` | SSH user with Docker access |
| `BILL_SSH_PRIVATE_KEY` | Dedicated deployment SSH private key |
| `BILL_SSH_KNOWN_HOSTS` | Verified host key, including port when nonstandard |
| `DOCKERHUB_USERNAME` | Docker Hub publisher, normally `sandboxcomet` |
| `DOCKERHUB_TOKEN` | Token authorized to push the application repository |

Optional variable `BILL_DEPLOY_ROOT` defaults to `/var/opt/sandbox/bill`. Do not configure production secrets in the repository source. The workflow uses a one-hour SSH agent and an environment-backed Docker credential helper; no private key or registry password is written to disk. Completed migration containers and VM releases are retained; cleanup needs separate approval. Build workspaces live on the ephemeral GitHub-hosted runner.

## One-time VM preparation

The authorized destination is the ESS VM, runtime root `/var/opt/sandbox/bill`. Runtime paths must be outside Git, free of symlinks and nested worktrees; the deploy script verifies these constraints before writing. Provision an untracked `shared/.env` with mode 0600 after proving the exact target is untracked. Do not copy the development database, authentication secrets, or development URL as production configuration.

```text
/var/opt/sandbox/bill/
  shared/.env
  releases/<sha>-<run>-<attempt>/compose.yml
  releases/<sha>-<run>-<attempt>/release.env
  current-release
```

Required runtime settings are:

```dotenv
AUTH_URL=https://bill.wonglao.com
AUTH_SECRET=<new random secret, at least 32 characters>
PAYMENT_LINK_SECRET=<new random secret, at least 32 characters>
BILL_DB_PASSWORD=<new URL-safe password, at least 24 characters>
BILL_DB_ROOT_PASSWORD=<different new URL-safe password, at least 24 characters>
AUTH_GOOGLE_ID=<Google OAuth client ID>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>
AUTH_LINE_ID=<LINE client ID if used>
AUTH_LINE_SECRET=<LINE client secret if used>
EASY_SLIP_KEY=<production EasySlip key>
R2_ENDPOINT=<private slip storage endpoint>
R2_ACCESS_KEY_ID=<bucket-scoped key>
R2_SECRET_ACCESS_KEY=<bucket-scoped secret>
PAYMENT_R2_BUCKET_NAME=<private slip bucket>
```

At least one complete OAuth provider is required. Configure callbacks `https://bill.wonglao.com/api/auth/callback/google` and `/api/auth/callback/line` for the enabled providers. Application `DATABASE_URL` is supplied by Compose and points only at the independent `wonglao_bill` database on its internal database service. Database passwords must contain only letters, digits, `_` or `-`. The app is capped at 512 MiB and the independent MySQL container at 384 MiB, with a 64 MiB InnoDB buffer pool and 30 connections. The named volume `wonglao_bill_database` is persistent; the database is not published on a host port. Existing local accounts and bills are not imported.

The VM must have Docker Compose, Python 3, Git, registry pull access, the existing external `production` network, and the ESS-style Traefik `https` entrypoint. The app connects to that network using `Host(bill.wonglao.com)`, internal port 3000 and TLS. Ensure the proxy has a valid certificate covering this hostname; the workflow does not modify the proxy's tracked configuration or assume a certificate resolver. Point DNS to the confirmed VM and verify the public certificate before launch. `docs/nginx.conf` remains an alternative example for separate Nginx deployments; it is not used by this workflow.

## Automatic CI/CD deployment

Push source to `main`, or run **Deploy Clear Toh** manually on `main`. The workflow preserves the previous image before publishing `latest`, pulls latest, verifies the workflow's published digest, starts the independent database, applies Prisma migrations, starts the app and checks database-backed health. All current migrations add schema; later migrations must be reviewed before deployment.

Later deployments automatically replace the existing `wonglao-bill` app container. The owner clarified that the AI deletion-approval policy applies to direct AI actions, not routine CI/CD rollouts; no container-ID approval input is required. The database container is started in place, never implicitly recreated. No prune, volume deletion or backup cleanup is performed. App replacement retains database data and the previous image backup. Direct resource deletions performed by an AI agent still require the owner's approval.

Release records retain image tag, digest and runtime path without secrets. The running reference must remain `:latest`; the image ID must equal the refreshed image and its registry digest must match the build metadata. Failed health checks fail the workflow and retain artifacts for investigation; rollback is reviewed separately.

## Launch validation

Verify `https://bill.wonglao.com/api/health` returns 200 and `{"status":"ok"}`, home/login, actual Google/LINE sign-in, public shared/payment access without login, production QR amount, private slip storage and a controlled real payment verification. Production QR uses the actual amount; the 2-baht test override is development-only. These user/payment flows have not been claimed as production verified merely by creating the workflow.
