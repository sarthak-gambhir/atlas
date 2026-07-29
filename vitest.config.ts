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
    // Node 24's child_process fork workers (Vitest's default "forks" pool) fail
    // to initialize the worker runtime here, so `describe` throws "Cannot read
    // properties of undefined (reading 'config')". Worker threads work reliably.
    pool: 'threads',
    // The API suites share one Postgres database and truncate between cases, so
    // running files concurrently would let them wipe each other's fixtures.
    fileParallelism: false,
  },
});
