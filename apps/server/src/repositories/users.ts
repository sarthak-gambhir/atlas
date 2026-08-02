import type { UserRole } from '@atlas/shared';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { Database } from '../db/index.ts';
import { projects, tasks, users } from '../db/schema.ts';

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
  username?: string;
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

  if (patch.username !== undefined) values.username = patch.username.trim();
  if (patch.displayName !== undefined) values.displayName = patch.displayName;
  if (patch.role !== undefined) values.role = patch.role;
  if (patch.disabled !== undefined) values.disabledAt = patch.disabled ? new Date() : null;
  if (patch.passwordHash !== undefined) values.passwordHash = patch.passwordHash;

  const [row] = await db.update(users).set(values).where(eq(users.id, id)).returning();
  return row ? toUserRecord(row) : undefined;
}

/**
 * Permanently removes a user. `tasks.assignee_id` (ON DELETE set null),
 * `project_members.user_id` (cascade) and `sessions.user_id` (cascade) resolve
 * themselves, but `tasks.created_by` is NOT NULL, so those tasks are handed to
 * the acting admin first. Projects the user owned are archived (and their
 * `owner_id` is nulled by the FK) so nothing changes for other users afterward.
 */
export async function deleteUser(
  db: Database,
  id: string,
  reassignCreatedByTo: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.update(tasks).set({ createdBy: reassignCreatedByTo }).where(eq(tasks.createdBy, id));

    // Archive their projects before the FK nulls the owner, so they become read-only.
    await tx
      .update(projects)
      .set({ archivedAt: sql`coalesce(${projects.archivedAt}, now())`, updatedAt: new Date() })
      .where(eq(projects.ownerId, id));

    const rows = await tx.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    return rows.length > 0;
  });
}
