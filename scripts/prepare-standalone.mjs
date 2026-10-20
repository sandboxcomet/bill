import { cpSync } from 'node:fs';
// Build output is generated and untracked; copy assets for the standalone server.
cpSync('public', '.next/standalone/public', { recursive: true });
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
