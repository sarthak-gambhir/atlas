import type { UserRole } from '@atlas/shared';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { Database } from '../db/index.ts';
import { users } from '../db/schema.ts';

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  disabledAt: string | null;
  createdAt: string;
}

export interface UserWithSecret extends UserRecord {
  passwordHash: string;
}

export interface NewUser {
  username: string;
  displayName: string;
  passwordHash: string;
  role?: UserRole;
}

type UserRow = typeof users.$inferSelect;

export function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    disabledAt: row.disabledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createUser(db: Database, input: NewUser): Promise<UserRecord> {
  const [row] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      username: input.username.trim(),
      displayName: input.displayName.trim(),
      passwordHash: input.passwordHash,
      role: input.role ?? 'member',
    })
    .returning();

  if (!row) throw new Error('Insert returned no row');
  return toUserRecord(row);
}

/** Case-insensitive, matching the `lower(username)` unique index. */
export async function findUserByUsername(
  db: Database,
  username: string,
): Promise<UserWithSecret | undefined> {
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);

  return row ? { ...toUserRecord(row), passwordHash: row.passwordHash } : undefined;
}

export async function findUserById(db: Database, id: string): Promise<UserRecord | undefined> {
  const [row] = await db.select().from(users).where(sql`${users.id} = ${id}`).limit(1);
  return row ? toUserRecord(row) : undefined;
}

export async function listUsers(db: Database): Promise<UserRecord[]> {
  const rows = await db.select().from(users).orderBy(asc(users.displayName));
  return rows.map(toUserRecord);
}

export async function countUsers(db: Database): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  return row?.count ?? 0;
}

/** Admins who can still sign in, used to refuse locking everyone out. */
export async function countActiveAdmins(db: Database): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.disabledAt)));

  return row?.count ?? 0;
}

export interface UserPatch {
  displayName?: string;
  role?: UserRole;
  disabled?: boolean;
  passwordHash?: string;
}

export async function updateUser(
  db: Database,
  id: string,
  patch: UserPatch,
): Promise<UserRecord | undefined> {
  const values: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

  if (patch.displayName !== undefined) values.displayName = patch.displayName;
  if (patch.role !== undefined) values.role = patch.role;
  if (patch.disabled !== undefined) values.disabledAt = patch.disabled ? new Date() : null;
  if (patch.passwordHash !== undefined) values.passwordHash = patch.passwordHash;

  const [row] = await db.update(users).set(values).where(eq(users.id, id)).returning();
  return row ? toUserRecord(row) : undefined;
}
