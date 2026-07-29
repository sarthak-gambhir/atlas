import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, isNull, lt, ne } from 'drizzle-orm';

import type { Database } from '../db/index.ts';
import { sessions, users } from '../db/schema.ts';
import { toUserRecord, type UserRecord } from '../repositories/users.ts';

export const SESSION_COOKIE = 'atlas_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * How stale a session may get before its expiry is pushed out again. Refreshing
 * on every request would mean a database write per page load, which the Neon
 * free tier's compute budget will not thank us for.
 */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** The cookie carries the raw token; only this digest is ever persisted. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(db: Database, userId: string): Promise<IssuedSession> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });

  return { token, expiresAt };
}

export interface ActiveSession {
  sessionId: string;
  user: UserRecord;
}

export async function loadSession(
  db: Database,
  token: string,
): Promise<ActiveSession | undefined> {
  const sessionId = hashToken(token);

  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, new Date()),
        isNull(users.disabledAt),
      ),
    )
    .limit(1);

  if (!row) return undefined;

  if (Date.now() - row.session.lastSeenAt.getTime() > REFRESH_INTERVAL_MS) {
    const now = new Date();
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) })
      .where(eq(sessions.id, sessionId));
  }

  return { sessionId, user: toUserRecord(row.user) };
}

export async function revokeSession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function revokeAllSessionsForUser(db: Database, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Used when someone changes their own password: every other device is signed
 * out, but the session doing the changing survives.
 */
export async function revokeOtherSessionsForUser(
  db: Database,
  userId: string,
  keepToken: string,
): Promise<void> {
  await db
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, hashToken(keepToken))));
}

/** Called by the daily cron. Returns how many rows were removed. */
export async function sweepExpiredSessions(db: Database): Promise<number> {
  const removed = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
  return removed.length;
}
