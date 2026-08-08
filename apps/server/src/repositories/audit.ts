import {
  AUDIT_PAGE_SIZE,
  type AuditAction,
  type AuditLogDto,
  type AuditLogPageDto,
  type AuditQuery,
} from '@atlas/shared';
import { and, count, desc, eq, type SQL } from 'drizzle-orm';

import { shouldSkipAudit } from '../audit/exclude.ts';
import type { Database } from '../db/index.ts';
import { auditLogs, projects } from '../db/schema.ts';

export interface AuditActor {
  id: string;
  username: string;
}

export interface RecordAuditInput {
  actor: AuditActor;
  action: AuditAction;
  entityType: 'task' | 'subtask' | 'project' | 'user';
  entityId?: string | null;
  /** The project the action is scoped to, used for demo exclusion and filtering. */
  projectId?: string | null;
  /** For user.* actions, the affected user's username (to exclude demo targets). */
  targetUsername?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Appends an audit entry unless it should be excluded (demo actor, demo target
 * or a demo-owned project). Best-effort: an audit failure is swallowed so it can
 * never turn a successful mutation into a failed request.
 */
export async function recordAudit(db: Database, input: RecordAuditInput): Promise<void> {
  try {
    const skip = await shouldSkipAudit(db, {
      actorUsername: input.actor.username,
      projectId: input.projectId,
      targetUsername: input.targetUsername,
    });
    if (skip) return;

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: input.actor.id,
      actorUsername: input.actor.username,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      projectId: input.projectId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch {
    // Auditing is a side effect; never surface its failure to the caller.
  }
}

/** Newest-first page of audit entries, with the project name resolved for display. */
export async function listAuditLogs(db: Database, query: AuditQuery): Promise<AuditLogPageDto> {
  const conditions: SQL[] = [];
  if (query.action) conditions.push(eq(auditLogs.action, query.action));
  if (query.actorUserId) conditions.push(eq(auditLogs.actorUserId, query.actorUserId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const limit = query.limit ?? AUDIT_PAGE_SIZE;
  const offset = query.offset ?? 0;

  const rows = await db
    .select({ log: auditLogs, projectName: projects.name })
    .from(auditLogs)
    .leftJoin(projects, eq(projects.id, auditLogs.projectId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [totals] = await db.select({ value: count() }).from(auditLogs).where(where);

  return {
    rows: rows.map(({ log, projectName }): AuditLogDto => ({
      id: log.id,
      actorUserId: log.actorUserId,
      actorUsername: log.actorUsername,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      projectId: log.projectId,
      projectName: projectName ?? null,
      metadata: (log.metadata as Record<string, unknown> | null) ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
    total: Number(totals?.value ?? 0),
  };
}
