import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// Build stamp shown in Settings → About, so you can tell which version a phone has.
const sha = (process.env.GITHUB_SHA || (() => { try { return execSync('git rev-parse HEAD').toString(); } catch { return 'dev'; } })()).trim().slice(0, 7);

// Relative base so the build works on GitHub Pages under /alliance-tracker/.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __BUILD__: JSON.stringify({ sha, time: new Date().toISOString() }) },
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
