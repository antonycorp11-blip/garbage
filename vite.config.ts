import { defineConfig } from 'vite';

import { execSync } from 'node:child_process';

// Cloudflare Workers Builds exposes the commit; fall back to git, then to 'dev'
let rev = (process.env.WORKERS_CI_COMMIT_SHA || '').slice(0, 7) || 'dev';
if (rev === 'dev') {
  try { rev = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'; } catch { /* no git */ }
}
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  define: { __BUILD__: JSON.stringify(`${rev} · ${stamp}`) },
  base: './',
  server: { host: true },
  test: { environment: 'node' },
} as any);
