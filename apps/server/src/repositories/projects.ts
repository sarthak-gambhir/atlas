import {
  CLOSED_STATUSES,
  type CreateProjectInput,
  type ProjectDto,
  type ProjectMemberRole,
  type UpdateProjectInput,
  type UserRole,
} from '@atlas/shared';
import { and, asc, eq, exists, inArray, isNull, notInArray, sql } from 'drizzle-orm';

import type { Database } from '../db/index.ts';
import {
  projectDefaultTags,
  projectFavorites,
  projectMembers,
  projects,
  tags,
  tasks,
} from '../db/schema.ts';

type ProjectRow = typeof projects.$inferSelect;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Who is asking. Admins see everything; members only their own projects. */
export interface ProjectViewer {
  id: string;
  role: UserRole;
}

interface Counts {
  openTaskCount: number;
  doneTaskCount: number;
  totalTaskCount: number;
}

interface Member {
  userId: string;
  role: ProjectMemberRole;
}

function toDto(
  row: ProjectRow,
  counts: Counts,
  defaultTags: string[],
  members: Member[],
  isFavorite: boolean,
): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerId: row.ownerId ?? null,
    memberIds: members.map((member) => member.userId),
    memberRoles: Object.fromEntries(members.map((member) => [member.userId, member.role])),
    icon: (row.icon as ProjectDto['icon']) ?? null,
    defaults: {
      assigneeId: row.defaultAssigneeId,
      impact: row.defaultImpact,
      effort: row.defaultEffort,
      confidence: row.defaultConfidence,
      tags: defaultTags,
    },
    archivedAt: row.archivedAt?.toISOString() ?? null,
    openTaskCount: counts.openTaskCount,
    doneTaskCount: counts.doneTaskCount,
    totalTaskCount: counts.totalTaskCount,
    isFavorite,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Filtered aggregates, so one grouped query yields every count the list needs. */
const totalTaskCount = sql<number>`count(${tasks.id})::int`;
const openTaskCount = sql<number>`count(${tasks.id}) filter (where ${notInArray(
  tasks.status,
  [...CLOSED_STATUSES],
)})::int`;
const doneTaskCount = sql<number>`count(${tasks.id}) filter (where ${inArray(
  tasks.status,
  [...CLOSED_STATUSES],
)})::int`;

/** Default tag names per project, one query rather than a count-inflating join. */
async function loadDefaultTags(db: Database, projectIds: string[]): Promise<Map<string, string[]>> {
  const byProject = new Map<string, string[]>();
  if (projectIds.length === 0) return byProject;

  const rows = await db
    .select({ projectId: projectDefaultTags.projectId, name: tags.name })
    .from(projectDefaultTags)
    .innerJoin(tags, eq(tags.id, projectDefaultTags.tagId))
    .where(inArray(projectDefaultTags.projectId, projectIds))
    .orderBy(tags.name);

  for (const row of rows) {
    const existing = byProject.get(row.projectId);
    if (existing) existing.push(row.name);
    else byProject.set(row.projectId, [row.name]);
  }

  return byProject;
}

/** Members (with their role) per project, one query rather than a count-inflating join. */
async function loadMembers(db: Database, projectIds: string[]): Promise<Map<string, Member[]>> {
  const byProject = new Map<string, Member[]>();
  if (projectIds.length === 0) return byProject;

  const rows = await db
    .select({
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .where(inArray(projectMembers.projectId, projectIds));

  for (const row of rows) {
    const member: Member = { userId: row.userId, role: row.role as ProjectMemberRole };
    const existing = byProject.get(row.projectId);
    if (existing) existing.push(member);
    else byProject.set(row.projectId, [member]);
  }

  return byProject;
}

/** The subset of `projectIds` that `userId` has favorited. */
async function loadFavorites(
  db: Database,
  projectIds: string[],
  userId: string,
): Promise<Set<string>> {
  if (projectIds.length === 0 || !userId) return new Set();

  const rows = await db
    .select({ projectId: projectFavorites.projectId })
    .from(projectFavorites)
    .where(
      and(
        eq(projectFavorites.userId, userId),
        inArray(projectFavorites.projectId, projectIds),
      ),
    );

  return new Set(rows.map((row) => row.projectId));
}

/** Correlated `exists` so non-admins only match projects they belong to. */
function memberOnly(db: Database, viewer: ProjectViewer) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, viewer.id)),
      ),
  );
}

export async function listProjects(
  db: Database,
  viewer: ProjectViewer,
  includeArchived = false,
): Promise<ProjectDto[]> {
  const conditions = [];
  if (!includeArchived) conditions.push(isNull(projects.archivedAt));
  if (viewer.role !== 'admin') conditions.push(memberOnly(db, viewer));

  const rows = await db
    .select({ project: projects, openTaskCount, doneTaskCount, totalTaskCount })
    .from(projects)
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(projects.id)
    .orderBy(asc(projects.name));

  const ids = rows.map((row) => row.project.id);
  const [tagsByProject, membersByProject, favorites] = await Promise.all([
    loadDefaultTags(db, ids),
    loadMembers(db, ids),
    loadFavorites(db, ids, viewer.id),
  ]);

  return rows.map((row) =>
    toDto(
      row.project,
      {
        openTaskCount: row.openTaskCount,
        doneTaskCount: row.doneTaskCount,
        totalTaskCount: row.totalTaskCount,
      },
      tagsByProject.get(row.project.id) ?? [],
      membersByProject.get(row.project.id) ?? [],
      favorites.has(row.project.id),
    ),
  );
}

export async function getProject(
  db: Database,
  id: string,
  viewer: ProjectViewer,
): Promise<ProjectDto | undefined> {
  const [row] = await db
    .select({ project: projects, openTaskCount, doneTaskCount, totalTaskCount })
    .from(projects)
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .where(eq(projects.id, id))
    .groupBy(projects.id);

  if (!row) return undefined;

  const [tagsByProject, membersByProject, favorites] = await Promise.all([
    loadDefaultTags(db, [id]),
    loadMembers(db, [id]),
    loadFavorites(db, [id], viewer.id),
  ]);
  const members = membersByProject.get(id) ?? [];

  // A non-admin may only see a project they belong to.
  if (viewer.role !== 'admin' && !members.some((member) => member.userId === viewer.id)) {
    return undefined;
  }

  return toDto(
    row.project,
    {
      openTaskCount: row.openTaskCount,
      doneTaskCount: row.doneTaskCount,
      totalTaskCount: row.totalTaskCount,
    },
    tagsByProject.get(id) ?? [],
    members,
    favorites.has(id),
  );
}

/** The bits an authorization check needs, without the count aggregates. */
export async function getProjectAuth(
  db: Database,
  id: string,
): Promise<{ ownerId: string | null; archivedAt: Date | null } | undefined> {
  const [row] = await db
    .select({ ownerId: projects.ownerId, archivedAt: projects.archivedAt })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return row ? { ownerId: row.ownerId ?? null, archivedAt: row.archivedAt ?? null } : undefined;
}

export async function isProjectArchived(db: Database, projectId: string): Promise<boolean> {
  const [row] = await db
    .select({ archivedAt: projects.archivedAt })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.archivedAt != null;
}

export async function isProjectMember(
  db: Database,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ one: sql`1` })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return row != null;
}

/**
 * Whether the viewer may edit tasks in a project: admins always, the owner
 * always, and members whose role is `editor`. Viewers (and non-members) cannot.
 */
export async function canEditProject(
  db: Database,
  projectId: string,
  viewer: ProjectViewer,
): Promise<boolean> {
  if (viewer.role === 'admin') return true;

  const [row] = await db
    .select({ ownerId: projects.ownerId, role: projectMembers.role })
    .from(projects)
    .leftJoin(
      projectMembers,
      and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, viewer.id)),
    )
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!row) return false;
  if (row.ownerId === viewer.id) return true;
  return row.role === 'editor';
}

/** Dedupes case-insensitively and creates any tag that does not exist yet. */
async function resolveTagIds(tx: Transaction, names: string[]): Promise<string[]> {
  const unique = new Map<string, string>();
  for (const name of names) {
    const trimmed = name.trim();
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

async function replaceDefaultTags(
  tx: Transaction,
  projectId: string,
  names: string[],
): Promise<void> {
  await tx.delete(projectDefaultTags).where(eq(projectDefaultTags.projectId, projectId));

  const tagIds = await resolveTagIds(tx, names);
  if (tagIds.length > 0) {
    await tx.insert(projectDefaultTags).values(tagIds.map((tagId) => ({ projectId, tagId })));
  }
}

export async function createProject(
  db: Database,
  input: CreateProjectInput,
  ownerId: string,
): Promise<ProjectDto> {
  const id = crypto.randomUUID();
  const defaults = input.defaults;

  await db.transaction(async (tx) => {
    await tx.insert(projects).values({
      id,
      name: input.name,
      description: input.description ?? null,
      ownerId,
      icon: input.icon ?? null,
      defaultAssigneeId: defaults?.assigneeId ?? null,
      defaultImpact: defaults?.impact ?? null,
      defaultEffort: defaults?.effort ?? null,
      defaultConfidence: defaults?.confidence ?? null,
    });

    // The creator is the first member (and owner), so the project is never memberless.
    await tx
      .insert(projectMembers)
      .values({ projectId: id, userId: ownerId, role: 'editor' })
      .onConflictDoNothing();

    if (defaults?.tags?.length) await replaceDefaultTags(tx, id, defaults.tags);
  });

  const created = await getProject(db, id, { id: ownerId, role: 'admin' });
  if (!created) throw new Error('Project vanished immediately after insert');
  return created;
}

export async function updateProject(
  db: Database,
  id: string,
  input: UpdateProjectInput,
): Promise<ProjectDto | undefined> {
  const patch: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };

  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description ?? null;
  if (input.icon !== undefined) patch.icon = input.icon ?? null;
  if (input.archived !== undefined) patch.archivedAt = input.archived ? new Date() : null;

  // A present `defaults` block replaces the whole default set.
  if (input.defaults !== undefined) {
    patch.defaultAssigneeId = input.defaults.assigneeId ?? null;
    patch.defaultImpact = input.defaults.impact ?? null;
    patch.defaultEffort = input.defaults.effort ?? null;
    patch.defaultConfidence = input.defaults.confidence ?? null;
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(projects)
      .set(patch)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    if (!row) return false;

    if (input.defaults !== undefined) {
      await replaceDefaultTags(tx, id, input.defaults.tags ?? []);
    }
    return true;
  });

  // Read back as an admin: the caller already passed the ownership check.
  return updated ? getProject(db, id, { id: '', role: 'admin' }) : undefined;
}

/** Adds a member with a role (default `editor`). Idempotent on the (project, user) key. */
export async function addProjectMember(
  db: Database,
  projectId: string,
  userId: string,
  role: ProjectMemberRole = 'editor',
): Promise<ProjectDto | undefined> {
  await db.insert(projectMembers).values({ projectId, userId, role }).onConflictDoNothing();
  return getProject(db, projectId, { id: '', role: 'admin' });
}

/** Changes an existing member's role. Returns undefined if they are not a member. */
export async function updateMemberRole(
  db: Database,
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
): Promise<ProjectDto | undefined> {
  const updated = await db
    .update(projectMembers)
    .set({ role })
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .returning({ userId: projectMembers.userId });
  if (updated.length === 0) return undefined;
  return getProject(db, projectId, { id: '', role: 'admin' });
}

/** Hands the project to another user, making them a member if they were not. */
export async function transferProjectOwnership(
  db: Database,
  projectId: string,
  userId: string,
): Promise<ProjectDto | undefined> {
  await db.transaction(async (tx) => {
    // The owner must be able to edit, so land them as an editor if newly added.
    await tx
      .insert(projectMembers)
      .values({ projectId, userId, role: 'editor' })
      .onConflictDoUpdate({
        target: [projectMembers.projectId, projectMembers.userId],
        set: { role: 'editor' },
      });
    await tx
      .update(projects)
      .set({ ownerId: userId, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  });

  return getProject(db, projectId, { id: '', role: 'admin' });
}

/**
 * Removes a member and repairs the assignment invariant: their tasks in this
 * project become unassigned, and a stale default assignee is cleared.
 */
export async function removeProjectMember(
  db: Database,
  projectId: string,
  userId: string,
): Promise<ProjectDto | undefined> {
  await db.transaction(async (tx) => {
    await tx
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

    await tx
      .update(tasks)
      .set({ assigneeId: null, updatedAt: new Date() })
      .where(and(eq(tasks.projectId, projectId), eq(tasks.assigneeId, userId)));

    await tx
      .update(projects)
      .set({ defaultAssigneeId: null, updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.defaultAssigneeId, userId)));
  });

  return getProject(db, projectId, { id: '', role: 'admin' });
}

/** Sets or clears the viewer's favorite flag on a project. Idempotent. */
export async function setProjectFavorite(
  db: Database,
  projectId: string,
  userId: string,
  favorite: boolean,
): Promise<void> {
  if (favorite) {
    await db.insert(projectFavorites).values({ projectId, userId }).onConflictDoNothing();
  } else {
    await db
      .delete(projectFavorites)
      .where(
        and(eq(projectFavorites.projectId, projectId), eq(projectFavorites.userId, userId)),
      );
  }
}

/** Tasks survive: the foreign key nulls their `project_id`. */
export async function deleteProject(db: Database, id: string): Promise<boolean> {
  const removed = await db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id });
  return removed.length > 0;
}
