import {
  CLOSED_STATUSES,
  bucketFor,
  compareForBacklog,
  computeScore,
  toIsoDate,
  type BulkUpdateInput,
  type CreateTaskInput,
  type ScoringSettings,
  type TaskDto,
  type TaskFilter,
  type UpdateTaskInput,
} from '@atlas/shared';
import { and, eq, inArray, lte, notInArray, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../db/index.ts';
import { tags, taskTags, tasks } from '../db/schema.ts';

type TaskRow = typeof tasks.$inferSelect;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

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
    dueDate: row.dueDate,
    urgencyOverride: row.urgencyOverride,
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
    dueDate: row.dueDate,
    estimateHours: row.estimateHours,
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

function buildFilters(filter: TaskFilter): SQL[] {
  const conditions: SQL[] = [];

  if (filter.status) conditions.push(eq(tasks.status, filter.status));
  else if (!filter.includeClosed) conditions.push(notInArray(tasks.status, [...CLOSED_STATUSES]));

  if (filter.projectId) conditions.push(eq(tasks.projectId, filter.projectId));
  if (filter.assigneeId) conditions.push(eq(tasks.assigneeId, filter.assigneeId));
  if (filter.dueBefore) conditions.push(lte(tasks.dueDate, filter.dueBefore));

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

  return conditions;
}

export async function listTasks(
  db: Database,
  filter: TaskFilter,
  ctx: ScoringContext,
): Promise<TaskDto[]> {
  const conditions = buildFilters(filter);
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
    .sort((a, b) => compareForBacklog(a, b, ctx.settings, ctx.today));
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
      dueDate: input.dueDate ?? null,
      estimateHours: input.estimateHours ?? null,
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
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate ?? null;
  if (input.estimateHours !== undefined) patch.estimateHours = input.estimateHours ?? null;
  if (input.manualRank !== undefined) patch.manualRank = input.manualRank ?? null;

  if (input.status !== undefined) {
    patch.status = input.status;
    // Completion time follows the status rather than being set by hand.
    patch.completedAt = input.status === 'done' ? new Date() : null;
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(tasks).set(patch).where(eq(tasks.id, id)).returning({ id: tasks.id });
    if (!row) return false;

    if (input.tags !== undefined) await replaceTags(tx, id, input.tags ?? []);
    return true;
  });

  return updated ? getTask(db, id, ctx) : undefined;
}

/**
 * Applies one small patch to many tasks in a single statement. Returns the ids
 * that actually changed, so a stale selection reports honestly rather than
 * claiming to have updated rows that no longer exist.
 */
export async function bulkUpdateTasks(
  db: Database,
  ids: string[],
  input: BulkUpdateInput['patch'],
): Promise<string[]> {
  if (ids.length === 0) return [];

  const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };

  if (input.projectId !== undefined) patch.projectId = input.projectId ?? null;
  if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId ?? null;

  if (input.status !== undefined) {
    patch.status = input.status;
    patch.completedAt = input.status === 'done' ? new Date() : null;
  }

  const updated = await db
    .update(tasks)
    .set(patch)
    .where(inArray(tasks.id, ids))
    .returning({ id: tasks.id });

  return updated.map((row) => row.id);
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
