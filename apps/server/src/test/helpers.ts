import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../app.ts';
import { hashPassword } from '../auth/password.ts';
import { createDatabase, type Database } from '../db/index.ts';
import { loadEnv, type Env } from '../env.ts';
import { createUser, type UserRecord } from '../repositories/users.ts';

export interface TestContext {
  app: FastifyInstance;
  db: Database;
  close: () => Promise<void>;
}

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL must be set (see .env.example) to run API tests');
  }
  return url;
}

export async function createTestContext(env: Partial<Env> = {}): Promise<TestContext> {
  const handle = createDatabase(testDatabaseUrl());
  const app = buildApp({
    db: handle.db,
    env: { ...loadEnv(), nodeEnv: 'test', isProduction: false, cookieSecure: false, ...env },
    logger: false,
  });

  await app.ready();

  return {
    app,
    db: handle.db,
    close: async () => {
      await app.close();
      await handle.close();
    },
  };
}

/** Wipes every table. Cheap on a small test database and keeps cases independent. */
export async function resetDatabase(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table login_attempts, sessions, task_tags, tasks, tags, projects, settings, users restart identity cascade`,
  );
}

export const TEST_PASSWORD = 'test-password-123';

export async function seedUser(
  db: Database,
  overrides: { username?: string; displayName?: string; role?: 'admin' | 'member' } = {},
): Promise<UserRecord> {
  return createUser(db, {
    username: overrides.username ?? 'tester',
    displayName: overrides.displayName ?? 'Tester',
    passwordHash: await hashPassword(TEST_PASSWORD),
    role: overrides.role ?? 'member',
  });
}

/** Logs in and returns the raw Cookie header to replay on later requests. */
export async function login(
  app: FastifyInstance,
  username: string,
  password: string = TEST_PASSWORD,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Login failed with ${response.statusCode}: ${response.body}`);
  }

  const cookie = response.cookies.find((c) => c.name === 'atlas_session');
  if (!cookie) throw new Error('Login response carried no session cookie');
  return `${cookie.name}=${cookie.value}`;
}
