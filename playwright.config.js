// Screen tests: build the app, serve it, click through the main screens on a
// phone-sized screen using the data committed in public/data.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/screens',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Pixel 7'],
    // On GitHub the machine's preinstalled Chrome is used (PW_CHANNEL=chrome),
    // so tests don't depend on downloading a browser and its system packages.
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block', // test the app itself, not a cached copy
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
