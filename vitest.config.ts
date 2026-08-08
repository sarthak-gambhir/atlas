import { existsSync } from 'node:fs';

import { defineConfig } from 'vitest/config';

// The API and e2e suites talk to a real local Postgres, so they need the same
// .env the dev server uses. Workers inherit this process's environment.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  test: {
    projects: [
      {
        // Server + shared: real Postgres, Node runtime.
        test: {
          name: 'node',
          include: ['packages/**/src/**/*.test.ts', 'apps/server/**/src/**/*.test.{ts,tsx}'],
          environment: 'node',
          // Worker threads initialize the runtime reliably here; the default
          // "forks" pool has been flaky on Node 24. Tests are launched via
          // scripts/vitest.mjs, which normalizes the cwd drive-letter casing so
          // the worker runtime loads as a single module instance (that file
          // explains why this matters on Windows).
          pool: 'threads',
          // The API suites share one Postgres database and truncate between
          // cases, so running files concurrently would let them wipe each
          // other's fixtures.
          fileParallelism: false,
        },
      },
      {
        // Web: component and unit tests in a DOM environment. JSX is handled by
        // Vitest's transformer using the app's tsconfig (`jsx: "react-jsx"`).
        test: {
          name: 'web',
          include: ['apps/web/**/*.test.{ts,tsx}'],
          environment: 'happy-dom',
          globals: true,
          setupFiles: ['./apps/web/src/test/setup.ts'],
        },
      },
    ],
  },
});
