import {
  CLOSED_STATUSES,
  bucketFor,
  compareTasksByRank,
  computeScore,
  toIsoDate,
  type BulkUpdateInput,
  type CreateTaskInput,
  type ScoringSettings,
  type TaskDto,
  type TaskFilter,
  type UpdateTaskInput,
  type UserRole,
} from '@atlas/shared';
import { and, eq, exists, inArray, isNull, lte, notInArray, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../db/index.ts';
import { projectMembers, projects, tags, taskTags, tasks } from '../db/schema.ts';

type TaskRow = typeof tasks.$inferSelect;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Who is reading. Admins see every task; members are scoped to their projects. */
export interface TaskViewer {
  id: string;
  role: UserRole;
}

export interface ScoringContext {
  settings: ScoringSettings;
  /** Date-only "now", so every task in one response is scored against the same day. */
  today: string;
}

export function scoringContext(settings: ScoringSettings): ScoringContext {
  return { settings, today: toIsoDate(new Date()) };
}

function toDto(row: TaskRow, tagNames: string[], ctx: ScoringContext): TaskDto {
  const inputs = {
    impact: row.impact,
    effort: row.effort,
    confidence: row.confidence,
    status: row.status,
    dueStartDate: row.dueStartDate,
    dueEndDate: row.dueEndDate,
    urgencyOverride: row.urgencyOverride,
    completedAt: row.completedAt ? row.completedAt.toISOString().slice(0, 10) : null,
  };
  const score = computeScore(inputs, ctx.settings, ctx.today);

  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    projectId: row.projectId,
    assigneeId: row.assigneeId,
    impact: row.impact,
    effort: row.effort,
    confidence: row.confidence,
    urgencyOverride: row.urgencyOverride,
    dueStartDate: row.dueStartDate,
    dueEndDate: row.dueEndDate,
    manualRank: row.manualRank,
    tags: tagNames,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    score,
    bucket: bucketFor(score, ctx.settings.thresholds),
  };
}

/** One extra query rather than a join, so a task with many tags stays one row. */
async function loadTagsByTask(db: Database, taskIds: string[]): Promise<Map<string, string[]>> {
  const byTask = new Map<string, string[]>();
  if (taskIds.length === 0) return byTask;

  const rows = await db
    .select({ taskId: taskTags.taskId, name: tags.name })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .where(inArray(taskTags.taskId, taskIds))
    .orderBy(tags.name);

  for (const row of rows) {
    const existing = byTask.get(row.taskId);
    if (existing) existing.push(row.name);
    else byTask.set(row.taskId, [row.name]);
  }

  return byTask;
}

function buildFilters(db: Database, filter: TaskFilter, viewer: TaskViewer): SQL[] {
  const conditions: SQL[] = [];

  if (filter.status) conditions.push(eq(tasks.status, filter.status));
  else if (!filter.includeClosed) conditions.push(notInArray(tasks.status, [...CLOSED_STATUSES]));

  if (filter.projectId) conditions.push(eq(tasks.projectId, filter.projectId));
  if (filter.assigneeId) conditions.push(eq(tasks.assigneeId, filter.assigneeId));
  if (filter.dueBefore) conditions.push(lte(tasks.dueEndDate, filter.dueBefore));

  if (filter.q) {
    const pattern = `%${filter.q}%`;
    conditions.push(sql`(${tasks.title} ilike ${pattern} or ${tasks.notes} ilike ${pattern})`);
  }

  if (filter.tag) {
    conditions.push(
      sql`exists (
        select 1 from ${taskTags}
        join ${tags} on ${tags.id} = ${taskTags.tagId}
        where ${taskTags.taskId} = ${tasks.id} and lower(${tags.name}) = lower(${filter.tag})
      )`,
    );
  }

  // Membership scope: a member only sees project-less tasks or tasks in their
  // projects. (Assignment is member-only, so their assigned tasks are covered.)
  if (viewer.role !== 'admin') {
    conditions.push(
      sql`(${isNull(tasks.projectId)} or ${exists(
        db
          .select({ one: sql`1` })
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, tasks.projectId),
              eq(projectMembers.userId, viewer.id),
            ),
          ),
      )})`,
    );
  }

  // Tasks in an archived project drop out of every non-project-scoped list, so
  // an archived project stops competing in the ranked backlog.
  if (!filter.projectId) {
    conditions.push(
      sql`not exists (
        select 1 from ${projects} p
        where p.id = ${tasks.projectId} and p.archived_at is not null
      )`,
    );
  }

  return conditions;
}

export async function listTasks(
  db: Database,
  filter: TaskFilter,
  ctx: ScoringContext,
  viewer: TaskViewer,
): Promise<TaskDto[]> {
  const conditions = buildFilters(db, filter, viewer);
  const rows = await db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const tagsByTask = await loadTagsByTask(
    db,
    rows.map((row) => row.id),
  );

  return rows
    .map((row) => toDto(row, tagsByTask.get(row.id) ?? [], ctx))
    .sort((a, b) => compareTasksByRank(a, b, ctx.settings, ctx.today));
}

export async function getTask(
  db: Database,
  id: string,
  ctx: ScoringContext,
): Promise<TaskDto | undefined> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row) return undefined;

  const tagsByTask = await loadTagsByTask(db, [row.id]);
  return toDto(row, tagsByTask.get(row.id) ?? [], ctx);
}

/** Dedupes case-insensitively and creates any tag that does not exist yet. */
async function resolveTagIds(tx: Transaction, names: string[]): Promise<string[]> {
  const unique = new Map<string, string>();
  for (const name of names) {
    const trimmed = name.trim();
    // First spelling wins, so "Infra" then "infra" keeps the original casing.
    if (trimmed && !unique.has(trimmed.toLowerCase())) {
      unique.set(trimmed.toLowerCase(), trimmed);
    }
  }
  if (unique.size === 0) return [];

  await tx
    .insert(tags)
    .values([...unique.values()].map((name) => ({ id: crypto.randomUUID(), name })))
    .onConflictDoNothing();

  const rows = await tx
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(sql`lower(${tags.name})`, [...unique.keys()]));

  return rows.map((row) => row.id);
}

async function replaceTags(tx: Transaction, taskId: string, names: string[]): Promise<void> {
  await tx.delete(taskTags).where(eq(taskTags.taskId, taskId));

  const tagIds = await resolveTagIds(tx, names);
  if (tagIds.length > 0) {
    await tx.insert(taskTags).values(tagIds.map((tagId) => ({ taskId, tagId })));
  }
}

export async function createTask(
  db: Database,
  input: CreateTaskInput,
  createdBy: string,
  ctx: ScoringContext,
): Promise<TaskDto> {
  const id = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(tasks).values({
      id,
      title: input.title,
      notes: input.notes ?? null,
      status: input.status ?? 'backlog',
      projectId: input.projectId ?? null,
      assigneeId: input.assigneeId ?? null,
      impact: input.impact ?? 3,
      effort: input.effort ?? 3,
      confidence: input.confidence ?? 1,
      urgencyOverride: input.urgencyOverride ?? null,
      dueStartDate: input.dueStartDate ?? null,
      dueEndDate: input.dueEndDate ?? null,
      createdBy,
    });

    if (input.tags?.length) await replaceTags(tx, id, input.tags);
  });

  const created = await getTask(db, id, ctx);
  if (!created) throw new Error('Task vanished immediately after insert');
  return created;
}

export async function updateTask(
  db: Database,
  id: string,
  input: UpdateTaskInput,
  ctx: ScoringContext,
): Promise<TaskDto | undefined> {
  const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };

  if (input.title !== undefined) patch.title = input.title;
  if (input.notes !== undefined) patch.notes = input.notes ?? null;
  if (input.projectId !== undefined) patch.projectId = input.projectId ?? null;
  if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId ?? null;
  if (input.impact !== undefined) patch.impact = input.impact;
  if (input.effort !== undefined) patch.effort = input.effort;
  if (input.confidence !== undefined) patch.confidence = input.confidence;
  if (input.urgencyOverride !== undefined) patch.urgencyOverride = input.urgencyOverride ?? null;
  if (input.dueStartDate !== undefined) patch.dueStartDate = input.dueStartDate ?? null;
  if (input.dueEndDate !== undefined) patch.dueEndDate = input.dueEndDate ?? null;
  if (input.manualRank !== undefined) patch.manualRank = input.manualRank ?? null;

  if (input.status !== undefined) {
    patch.status = input.status;
    // Completion time follows the status rather than being set by hand, but it
    // survives an archive (so a done task stays visibly done) and a later
    // re-completion keeps the original date rather than restamping "now".
    if (input.status === 'done') {
      const [current] = await db
        .select({ completedAt: tasks.completedAt })
        .from(tasks)
        .where(eq(tasks.id, id));
      if (!current) return undefined;
      patch.completedAt = current.completedAt ?? new Date();
    } else if (input.status !== 'archived') {
      patch.completedAt = null;
    }
    // 'archived': leave completedAt untouched so the prior completion shows.
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(tasks).set(patch).where(eq(tasks.id, id)).returning({ id: tasks.id });
    if (!row) return false;

    if (input.tags !== undefined) await replaceTags(tx, id, input.tags ?? []);
    return true;
  });

  return updated ? getTask(db, id, ctx) : undefined;
}

export interface BulkOutcome {
  /** Ids that actually changed. */
  ids: string[];
  /** How many selected ids were left untouched by a rule. */
  skipped: number;
  /** Distinct reasons for the skips, for a one-line summary. */
  reasons: string[];
}

/**
 * Applies one small patch across a selection, skipping tasks a rule protects:
 * ones the viewer cannot see, ones in an archived project, archived tasks (for
 * anything but a status change) and ones whose resulting project would not
 * include a newly set assignee. Returns the ids that changed plus why others
 * were skipped, so a stale or mixed selection reports honestly. The caller
 * validates a non-null target project up front (archived / non-member).
 */
export async function bulkUpdateTasks(
  db: Database,
  ids: string[],
  input: BulkUpdateInput['patch'],
  viewer: TaskViewer,
): Promise<BulkOutcome> {
  if (ids.length === 0) return { ids: [], skipped: 0, reasons: [] };

  const rows = await db
    .select({ id: tasks.id, projectId: tasks.projectId, status: tasks.status })
    .from(tasks)
    .where(inArray(tasks.id, ids));

  const projectIds = [
    ...new Set(rows.map((row) => row.projectId).filter((id): id is string => id != null)),
  ];

  const archivedProjects = new Set<string>();
  if (projectIds.length > 0) {
    const archived = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(inArray(projects.id, projectIds), sql`${projects.archivedAt} is not null`));
    for (const row of archived) archivedProjects.add(row.id);
  }

  // A non-admin may only touch tasks in projects they can edit (owner or editor).
  const memberProjects = new Set<string>();
  const editProjects = new Set<string>();
  if (viewer.role !== 'admin' && projectIds.length > 0) {
    const rowsMember = await db
      .select({ projectId: projectMembers.projectId, role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, viewer.id), inArray(projectMembers.projectId, projectIds)));
    for (const row of rowsMember) {
      memberProjects.add(row.projectId);
      if (row.role === 'editor') editProjects.add(row.projectId);
    }
    const owned = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.ownerId, viewer.id), inArray(projects.id, projectIds)));
    for (const row of owned) {
      memberProjects.add(row.id);
      editProjects.add(row.id);
    }
  }

  const settingProject = input.projectId !== undefined;
  const targetProject = input.projectId ?? null;
  const assignee = input.assigneeId ?? null;
  const settingAssignee = input.assigneeId !== undefined && assignee != null;

  const assigneeProjects = new Set<string>();
  if (settingAssignee) {
    const candidates = settingProject ? (targetProject ? [targetProject] : []) : projectIds;
    if (candidates.length > 0) {
      const rowsMember = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(and(eq(projectMembers.userId, assignee), inArray(projectMembers.projectId, candidates)));
      for (const row of rowsMember) assigneeProjects.add(row.projectId);
    }
  }

  const reasons = new Set<string>();
  const eligible: string[] = [];

  for (const row of rows) {
    if (viewer.role !== 'admin' && row.projectId != null) {
      if (!memberProjects.has(row.projectId)) {
        reasons.add('no access');
        continue;
      }
      if (!editProjects.has(row.projectId)) {
        reasons.add('view-only project');
        continue;
      }
    }
    if (row.projectId != null && archivedProjects.has(row.projectId)) {
      reasons.add('in an archived project');
      continue;
    }
    if (row.status === 'archived' && (input.projectId !== undefined || input.assigneeId !== undefined)) {
      reasons.add('archived task');
      continue;
    }
    if (settingAssignee) {
      const resultingProject = settingProject ? targetProject : row.projectId;
      if (resultingProject != null && !assigneeProjects.has(resultingProject)) {
        reasons.add('assignee is not a member of the project');
        continue;
      }
    }
    eligible.push(row.id);
  }

  if (eligible.length === 0) {
    return { ids: [], skipped: ids.length, reasons: [...reasons] };
  }

  const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  if (input.projectId !== undefined) patch.projectId = input.projectId ?? null;
  if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId ?? null;
  if (input.status !== undefined) {
    patch.status = input.status;
    // Archiving keeps each row's own completedAt (so done work stays done);
    // reopening to an active status clears it; completing stamps now.
    if (input.status === 'done') patch.completedAt = new Date();
    else if (input.status !== 'archived') patch.completedAt = null;
  }

  const updated = await db
    .update(tasks)
    .set(patch)
    .where(inArray(tasks.id, eligible))
    .returning({ id: tasks.id });

  const updatedIds = updated.map((row) => row.id);
  return { ids: updatedIds, skipped: ids.length - updatedIds.length, reasons: [...reasons] };
}

export async function deleteTask(db: Database, id: string): Promise<boolean> {
  const removed = await db.delete(tasks).where(eq(tasks.id, id)).returning({ id: tasks.id });
  return removed.length > 0;
}

/**
 * Writes a sparse rank so later insertions between two tasks do not require
 * renumbering the whole list.
 */
export async function reorderTasks(db: Database, orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;

  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(tasks)
        .set({ manualRank: (index + 1) * 1000, updatedAt: new Date() })
        .where(eq(tasks.id, id));
    }
  });
}

export async function unpinTask(db: Database, id: string): Promise<void> {
  await db.update(tasks).set({ manualRank: null, updatedAt: new Date() }).where(eq(tasks.id, id));
}
