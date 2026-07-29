import { and, gt, lt, sql } from 'drizzle-orm';

import type { Database } from '../db/index.ts';
import { loginAttempts } from '../db/schema.ts';

/** A username is locked out after this many failures inside the window. */
export const MAX_FAILURES = 10;
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** Attempts older than this are pruned by the daily sweep. */
const RETENTION_MS = 24 * 60 * 60 * 1000;

export async function recordLoginAttempt(
  db: Database,
  username: string,
  succeeded: boolean,
): Promise<void> {
  await db.insert(loginAttempts).values({ id: crypto.randomUUID(), username, succeeded });
}

export async function countRecentFailures(db: Database, username: string): Promise<number> {
  const since = new Date(Date.now() - FAILURE_WINDOW_MS);

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        sql`lower(${loginAttempts.username}) = lower(${username})`,
        gt(loginAttempts.attemptedAt, since),
        sql`${loginAttempts.succeeded} = false`,
      ),
    );

  return row?.count ?? 0;
}

export async function pruneLoginAttempts(db: Database): Promise<number> {
  const removed = await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.attemptedAt, new Date(Date.now() - RETENTION_MS)))
    .returning({ id: loginAttempts.id });
  return removed.length;
}
