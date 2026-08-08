import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

// The e2e suite talks to a real local Postgres, the same way the API tests do.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

/** Its own database, so an e2e run never touches dev or test data. */
function e2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;

  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('Set E2E_DATABASE_URL, or DATABASE_URL so it can be derived (see .env.example).');
  }
  const url = new URL(base);
  url.pathname = '/atlas_e2e';
  return url.toString();
}

const DATABASE_URL = e2eDatabaseUrl();
// Handed to the global setup, which runs in this same process.
process.env.ATLAS_E2E_DATABASE_URL = DATABASE_URL;

const API_PORT = 8788;
const WEB_PORT = 5174;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: WEB_URL,
    // Written by the global setup once it has logged the admin in.
    storageState: './e2e/.auth/admin.json',
    // Drive the already-installed Chrome instead of downloading a browser.
    channel: 'chrome',
    trace: 'retain-on-failure',
  },

  // The plan calls for a desktop and a laptop viewport; one spec runs under both.
  // The mobile suite is phone-specific, so the desktop viewports skip it and it
  // gets a dedicated project at a ~390px width.
  projects: [
    {
      name: 'desktop-1440',
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'laptop-1024',
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'mobile-390',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 5'], channel: 'chrome' },
    },
  ],

  webServer: [
    {
      command: 'node apps/server/src/dev.ts',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        DATABASE_URL,
        NODE_ENV: 'development',
        ATLAS_COOKIE_SECURE: 'false',
      },
    },
    {
      // Bind 127.0.0.1 explicitly: Vite otherwise listens on localhost/IPv6, which
      // the 127.0.0.1 readiness check and baseURL below cannot reach.
      command: `npm --workspace @atlas/web run dev -- --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { ATLAS_API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
