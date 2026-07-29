import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { request } from '@playwright/test';

/** Must match E2E_ADMIN in apps/server/src/scripts/seed-e2e.ts. */
const ADMIN = { username: 'e2e-admin', password: 'e2e-password-123' };
const WEB_URL = 'http://127.0.0.1:5174';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const seedScript = fileURLToPath(new URL('../apps/server/src/scripts/seed-e2e.ts', import.meta.url));
const storageState = fileURLToPath(new URL('.auth/admin.json', import.meta.url));

export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.ATLAS_E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('ATLAS_E2E_DATABASE_URL was not set by the Playwright config.');

  // Run the seed in a plain Node process: it imports the server's .ts modules,
  // which Node's type stripping resolves but Playwright's ESM loader does not.
  execFileSync(process.execPath, [seedScript], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  // The web server proxies /api to the e2e API, so logging in here mints a real
  // session cookie for the origin the tests run against.
  const context = await request.newContext({ baseURL: WEB_URL });
  const response = await context.post('/api/auth/login', { data: ADMIN });
  if (!response.ok()) {
    throw new Error(`e2e login failed: ${response.status()} ${await response.text()}`);
  }

  mkdirSync(dirname(storageState), { recursive: true });
  await context.storageState({ path: storageState });
  await context.dispose();
}
