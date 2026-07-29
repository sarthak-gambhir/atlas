import { CLOSED_STATUSES, type CreateProjectInput, type ProjectDto, type UpdateProjectInput } from '@atlas/shared';
import { asc, eq, isNull, notInArray, sql } from 'drizzle-orm';

import type { Database } from '../db/index.ts';
import { projects, tasks } from '../db/schema.ts';

type ProjectRow = typeof projects.$inferSelect;

function toDto(row: ProjectRow, openTaskCount: number): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    openTaskCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/** The open-task count comes from a filtered aggregate, so one query serves the list. */
const openTaskCount = sql<number>`count(${tasks.id}) filter (where ${notInArray(
  tasks.status,
  [...CLOSED_STATUSES],
)})::int`;

export async function listProjects(db: Database, includeArchived = false): Promise<ProjectDto[]> {
  const rows = await db
    .select({ project: projects, openTaskCount })
    .from(projects)
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .where(includeArchived ? undefined : isNull(projects.archivedAt))
    .groupBy(projects.id)
    .orderBy(asc(projects.name));

  return rows.map((row) => toDto(row.project, row.openTaskCount));
}

export async function createProject(
  db: Database,
  input: CreateProjectInput,
): Promise<ProjectDto> {
  const [row] = await db
    .insert(projects)
    .values({
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description ?? null,
    })
    .returning();

  if (!row) throw new Error('Insert returned no row');
  return toDto(row, 0);
}

export async function updateProject(
  db: Database,
  id: string,
  input: UpdateProjectInput,
): Promise<ProjectDto | undefined> {
  const patch: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };

  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.archived !== undefined) patch.archivedAt = input.archived ? new Date() : null;

  const [row] = await db.update(projects).set(patch).where(eq(projects.id, id)).returning();
  if (!row) return undefined;

  const [counted] = await db
    .select({ openTaskCount })
    .from(tasks)
    .where(eq(tasks.projectId, id));

  return toDto(row, counted?.openTaskCount ?? 0);
}

/** Tasks survive: the foreign key nulls their `project_id`. */
export async function deleteProject(db: Database, id: string): Promise<boolean> {
  const removed = await db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
  return removed.length > 0;
}
