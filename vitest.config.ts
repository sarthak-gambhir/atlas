import { existsSync } from 'node:fs';

import { defineConfig } from 'vitest/config';

// Tests talk to a real local Postgres, so they need the same .env the dev
// server uses. Workers inherit this process's environment.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.{ts,tsx}'],
    environment: 'node',
    // Worker threads initialize the runtime reliably here; the default "forks"
    // pool has been flaky on Node 24. Tests are launched via scripts/vitest.mjs,
    // which normalizes the cwd drive-letter casing so the worker runtime loads as
    // a single module instance (that file explains why this matters on Windows).
    pool: 'threads',
    // The API suites share one Postgres database and truncate between cases, so
    // running files concurrently would let them wipe each other's fixtures.
    fileParallelism: false,
  },
});
