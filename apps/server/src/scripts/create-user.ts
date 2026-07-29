import { createInterface, type Interface } from 'node:readline';
import { parseArgs } from 'node:util';

import { hashPassword } from '../auth/password.ts';
import { createDatabase } from '../db/index.ts';
import { loadEnv } from '../env.ts';
import { createUser, findUserByUsername } from '../repositories/users.ts';

interface EchoControllingInterface extends Interface {
  _writeToOutput?: (value: string) => void;
}

/** Reads a line from the terminal without echoing what is typed. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl: EchoControllingInterface = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    rl._writeToOutput = (value: string) => {
      // Print the prompt itself, swallow every echo of the typed characters.
      if (value.includes(question)) process.stdout.write(question);
    };

    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const { values } = parseArgs({
  options: {
    username: { type: 'string', short: 'u' },
    name: { type: 'string', short: 'n' },
    password: { type: 'string', short: 'p' },
    admin: { type: 'boolean', default: false },
  },
});

const username = values.username?.trim();
if (!username) {
  console.error(
    'Usage: npm run create-user -- --username <name> [--name "Display Name"] [--admin] [--password <pw>]',
  );
  process.exit(1);
}

const env = loadEnv();
if (!env.databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const password = values.password ?? process.env.ATLAS_PASSWORD ?? (await promptHidden('Password: '));
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const { db, close } = createDatabase(env.databaseUrl);
try {
  if (await findUserByUsername(db, username)) {
    console.error(`User "${username}" already exists.`);
    process.exit(1);
  }

  const user = await createUser(db, {
    username,
    displayName: values.name?.trim() || username,
    passwordHash: await hashPassword(password),
    role: values.admin ? 'admin' : 'member',
  });

  console.log(`Created ${user.role} "${user.username}" (${user.id})`);
} finally {
  await close();
}
