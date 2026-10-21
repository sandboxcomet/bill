<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## CI/CD deployment scope

The owner's deletion-approval policy governs actions performed directly by AI agents. It does not require per-run approval inputs for the normal CI/CD application rollout. The Deploy Clear Toh workflow may automatically replace the `wonglao-bill` app container when deploying `main`; do not add a container-ID approval gate to that workflow or its CI deployment scripts.

Keep the existing deployment protections: preserve the previous image in the registry before updating `latest`, verify the deployed image digest and health, start the existing database in place, and retain database volumes, backup images and migration containers. This CI/CD allowance does not authorize AI agents to delete resources directly or introduce unrelated cleanup.
