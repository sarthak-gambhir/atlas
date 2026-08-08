import { eq } from 'drizzle-orm';

import { isDemoUsername } from '../auth/demo.ts';
import type { Database } from '../db/index.ts';
import { projects, users } from '../db/schema.ts';

/**
 * True when a project is owned by one of the seeded demo accounts. The demo
 * workspace is shared and churns constantly, so its activity is deliberately
 * kept out of the audit trail. A missing project (already deleted) is treated
 * as non-demo: the delete route decides that case before the row is removed.
 */
export async function isDemoProject(db: Database, projectId: string): Promise<boolean> {
  const [row] = await db
    .select({ username: users.username })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.ownerId))
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.username != null && isDemoUsername(row.username);
}

export interface AuditExclusionInput {
  /** The username of whoever performed the action. */
  actorUsername: string;
  /** The project the action touched, if any. */
  projectId?: string | null;
  /** For user.* actions, the affected user's username. */
  targetUsername?: string | null;
}

/**
 * Whether an event should be dropped rather than recorded. Demo accounts and
 * anything scoped to a demo-owned project are excluded, whether the demo user
 * is the actor or the target.
 */
export async function shouldSkipAudit(
  db: Database,
  input: AuditExclusionInput,
): Promise<boolean> {
  if (isDemoUsername(input.actorUsername)) return true;
  if (input.targetUsername != null && isDemoUsername(input.targetUsername)) return true;
  if (input.projectId != null && (await isDemoProject(db, input.projectId))) return true;
  return false;
}
