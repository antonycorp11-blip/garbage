import { defineConfig } from 'vite';

import { execSync } from 'node:child_process';

let rev = 'dev';
try { rev = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* no git */ }
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  define: { __BUILD__: JSON.stringify(`${rev} · ${stamp}`) },
  base: './',
  server: { host: true },
  test: { environment: 'node' },
} as any);
