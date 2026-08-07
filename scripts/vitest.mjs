// Vitest launcher that normalizes the working directory's drive-letter casing
// before Vitest (and Node's module loader) start.
//
// Git Bash reports the cwd with a lowercase drive letter ("c:\atlas"), while Node
// resolves module specifiers with an uppercase one ("C:\atlas"). Because Node keys
// its module cache by absolute path, Vitest's worker-runtime modules get loaded
// twice under the two casings; the worker state attached to one instance is then
// invisible to the other, so every `describe` throws "Cannot read properties of
// undefined (reading 'config')" (or "Vitest failed to find the runner").
//
// Re-spawning Vitest with a canonical cwd means every module resolves under one
// casing. On PowerShell, cmd, and non-Windows shells the cwd already matches, so
// this is a transparent pass-through.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Upper-case a leading Windows drive letter so every absolute path we hand the
// child resolves under the same casing as its cwd. The bin path and cwd must
// agree, or Vitest's runtime loads twice (see the header comment).
const normalizeDrive = (p) => (/^[a-z]:/.test(p) ? p[0].toUpperCase() + p.slice(1) : p);

const require = createRequire(import.meta.url);
const pkgJsonPath = require.resolve('vitest/package.json');
const { bin } = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
const vitestBin = normalizeDrive(
  join(dirname(pkgJsonPath), typeof bin === 'string' ? bin : bin.vitest),
);

const args = process.argv.slice(2).map(normalizeDrive);

const child = spawn(process.execPath, [vitestBin, ...args], {
  cwd: normalizeDrive(process.cwd()),
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
