import type {
  BackupBundle,
  ExportedSubtask,
  ExportedTask,
  ImportResultDto,
  ProjectMemberRole,
} from '@atlas/shared';
import { alias } from 'drizzle-orm/pg-core';
import { eq, inArray } from 'drizzle-orm';

import type { Database } from './db/index.ts';
import {
  projectDefaultTags,
  projectMembers,
  projects,
  subtasks,
  tags,
  taskTags,
  tasks,
  users,
} from './db/schema.ts';
import { getScoringSettings, saveScoringSettings } from './repositories/settings.ts';

export interface BuildBackupOptions {
  /**
   * Limit the export to these projects and their tasks. Omitted (or empty) means
   * the whole database, matching the historical behaviour. Project-less tasks are
   * only included in an unscoped export.
   */
  projectIds?: string[];
}

/** Everything a fresh database needs to look like this one, minus credentials. */
export async function buildBackup(
  db: Database,
  options: BuildBackupOptions = {},
): Promise<BackupBundle> {
  const defaultAssignee = alias(users, 'default_assignee');
  const owner = alias(users, 'owner_user');

  const scope = options.projectIds?.length ? options.projectIds : null;
  const projectScope = scope ? inArray(projects.id, scope) : undefined;
  const taskScope = scope ? inArray(tasks.projectId, scope) : undefined;

  const [projectRows, taskRows, scoring] = await Promise.all([
    db
      .select({
        project: projects,
        defaultAssigneeUsername: defaultAssignee.username,
        ownerUsername: owner.username,
      })
      .from(projects)
      .leftJoin(defaultAssignee, eq(defaultAssignee.id, projects.defaultAssigneeId))
      .leftJoin(owner, eq(owner.id, projects.ownerId))
      .where(projectScope),
    db
      .select({ task: tasks, projectName: projects.name, assigneeUsername: users.username })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(taskScope),
    getScoringSettings(db),
  ]);

  // Subtasks for exactly the tasks being exported, grouped by parent, ordered.
  const exportedTaskIds = taskRows.map((row) => row.task.id);
  const subtasksByTask = new Map<string, ExportedSubtask[]>();
  if (exportedTaskIds.length > 0) {
    const subtaskRows = await db
      .select({
        taskId: subtasks.taskId,
        description: subtasks.description,
        done: subtasks.done,
        position: subtasks.position,
      })
      .from(subtasks)
      .where(inArray(subtasks.taskId, exportedTaskIds))
      .orderBy(subtasks.position, subtasks.createdAt);
    for (const row of subtaskRows) {
      const entry = { description: row.description, done: row.done, position: row.position };
      const existing = subtasksByTask.get(row.taskId);
      if (existing) existing.push(entry);
      else subtasksByTask.set(row.taskId, [entry]);
    }
  }

  const memberRows = await db
    .select({
      projectId: projectMembers.projectId,
      username: users.username,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .orderBy(users.username);

  const membersByProject = new Map<string, BackupBundle['projects'][number]['members']>();
  for (const row of memberRows) {
    const entry = { username: row.username, role: row.role as ProjectMemberRole };
    const existing = membersByProject.get(row.projectId);
    if (existing) existing.push(entry);
    else membersByProject.set(row.projectId, [entry]);
  }

  const tagRows = await db
    .select({ taskId: taskTags.taskId, name: tags.name })
    .from(taskTags)
    .innerJoin(tags, eq(tags.id, taskTags.tagId))
    .orderBy(tags.name);

  const tagsByTask = new Map<string, string[]>();
  for (const row of tagRows) {
    const existing = tagsByTask.get(row.taskId);
    if (existing) existing.push(row.name);
    else tagsByTask.set(row.taskId, [row.name]);
  }

  const defaultTagRows = await db
    .select({ projectId: projectDefaultTags.projectId, name: tags.name })
    .from(projectDefaultTags)
    .innerJoin(tags, eq(tags.id, projectDefaultTags.tagId))
    .orderBy(tags.name);

  const defaultTagsByProject = new Map<string, string[]>();
  for (const row of defaultTagRows) {
    const existing = defaultTagsByProject.get(row.projectId);
    if (existing) existing.push(row.name);
    else defaultTagsByProject.set(row.projectId, [row.name]);
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    scoring,
    projects: projectRows
      .map(({ project, defaultAssigneeUsername, ownerUsername }) => ({
        name: project.name,
        description: project.description,
        archived: project.archivedAt != null,
        icon: (project.icon as BackupBundle['projects'][number]['icon']) ?? null,
        owner: ownerUsername,
        members: membersByProject.get(project.id) ?? [],
        defaultAssignee: defaultAssigneeUsername,
        defaultImpact: project.defaultImpact,
        defaultEffort: project.defaultEffort,
        defaultConfidence: project.defaultConfidence as
          | BackupBundle['projects'][number]['defaultConfidence']
          | null,
        defaultTags: defaultTagsByProject.get(project.id) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    tasks: taskRows.map(({ task, projectName, assigneeUsername }) => ({
      title: task.title,
      notes: task.notes,
      status: task.status,
      project: projectName,
      assignee: assigneeUsername,
      impact: task.impact,
      effort: task.effort,
      confidence: task.confidence as ExportedTask['confidence'],
      urgencyOverride: task.urgencyOverride,
      dueStartDate: task.dueStartDate,
      dueEndDate: task.dueEndDate,
      manualRank: task.manualRank,
      tags: tagsByTask.get(task.id) ?? [],
      subtasks: subtasksByTask.get(task.id) ?? [],
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null,
    })),
  };
}

/**
 * Restores a bundle. Projects, tags and assignees are matched by name, so a
 * bundle can be imported into a database whose ids differ. People are never
 * created: a task assigned to someone unknown here arrives unassigned unless
 * the caller supplies an `assigneeMap` pointing that name at an existing user.
 * Whatever remains unmatched is reported back so the caller knows what dropped.
 */
export async function restoreBackup(
  db: Database,
  bundle: BackupBundle,
  mode: 'merge' | 'replace',
  importerId: string,
  assigneeMap: Record<string, string> = {},
  memberResolution: Record<string, 'add' | 'unassign'> = {},
): Promise<ImportResultDto> {
  const result: ImportResultDto = {
    projectsCreated: 0,
    tasksCreated: 0,
    tagsCreated: 0,
    membersAdded: 0,
    unknownAssignees: [],
    unassignedForMembership: [],
  };
  const unassignedForMembership = new Set<string>();

  const usernames = new Set(
    bundle.tasks.map((task) => task.assignee?.toLowerCase()).filter((name) => name != null),
  );

  // Owner, member and default-assignee usernames all need resolving, so load the
  // whole (small) roster rather than guessing which lookups will be needed.
  const knownUsers = await db.select({ id: users.id, username: users.username }).from(users);
  const userByName = new Map(knownUsers.map((user) => [user.username.toLowerCase(), user.id]));
  const validUserIds = new Set(knownUsers.map((user) => user.id));

  // A name that has no direct match may still be remapped onto a real user.
  const remapped = new Map<string, string>();
  for (const [name, targetId] of Object.entries(assigneeMap)) {
    const key = name.toLowerCase();
    if (!userByName.has(key) && validUserIds.has(targetId)) remapped.set(key, targetId);
  }

  const resolveAssignee = (name: string | null | undefined): string | undefined => {
    if (name == null) return undefined;
    const key = name.toLowerCase();
    return userByName.get(key) ?? remapped.get(key);
  };

  const missing = [...usernames].filter((name) => resolveAssignee(name) == null);
  result.unknownAssignees = missing.sort();

  await db.transaction(async (tx) => {
    if (mode === 'replace') {
      // task_tags and project_default_tags rows go with their parents via cascade.
      await tx.delete(tasks);
      await tx.delete(projects);
      await tx.delete(tags);
    }

    const tagByName = new Map(
      (await tx.select({ id: tags.id, name: tags.name }).from(tags)).map((row) => [
        row.name.toLowerCase(),
        row.id,
      ]),
    );

    // Creates a tag on first sight, reusing the shared name map across the run.
    const ensureTag = async (name: string): Promise<string> => {
      const key = name.toLowerCase();
      let tagId = tagByName.get(key);
      if (!tagId) {
        tagId = crypto.randomUUID();
        await tx.insert(tags).values({ id: tagId, name });
        tagByName.set(key, tagId);
        result.tagsCreated += 1;
      }
      return tagId;
    };

    const projectByName = new Map(
      (await tx.select({ id: projects.id, name: projects.name }).from(projects)).map((row) => [
        row.name.toLowerCase(),
        row.id,
      ]),
    );

    // Existing memberships, so the assignee reconciliation below knows who already belongs.
    const membersByProject = new Map<string, Set<string>>();
    for (const row of await tx
      .select({ projectId: projectMembers.projectId, userId: projectMembers.userId })
      .from(projectMembers)) {
      const set = membersByProject.get(row.projectId) ?? new Set<string>();
      set.add(row.userId);
      membersByProject.set(row.projectId, set);
    }

    const addMember = async (
      projectId: string,
      userId: string,
      role: ProjectMemberRole = 'editor',
    ): Promise<void> => {
      const set = membersByProject.get(projectId) ?? new Set<string>();
      if (set.has(userId)) return;
      await tx.insert(projectMembers).values({ projectId, userId, role }).onConflictDoNothing();
      set.add(userId);
      membersByProject.set(projectId, set);
    };

    for (const project of bundle.projects) {
      const key = project.name.toLowerCase();
      if (projectByName.has(key)) continue;

      const id = crypto.randomUUID();
      const ownerId = project.owner ? (userByName.get(project.owner.toLowerCase()) ?? null) : null;
      await tx.insert(projects).values({
        id,
        name: project.name,
        description: project.description ?? null,
        ownerId,
        icon: project.icon ?? null,
        defaultAssigneeId: resolveAssignee(project.defaultAssignee) ?? null,
        defaultImpact: project.defaultImpact ?? null,
        defaultEffort: project.defaultEffort ?? null,
        defaultConfidence: project.defaultConfidence ?? null,
        archivedAt: project.archived ? new Date() : null,
      });
      projectByName.set(key, id);
      result.projectsCreated += 1;

      // The owner is always a member (and must be able to edit); then the
      // bundle's explicit members, each with their exported role.
      if (ownerId) await addMember(id, ownerId, 'editor');
      for (const member of project.members ?? []) {
        const username = typeof member === 'string' ? member : member.username;
        const role = typeof member === 'string' ? 'editor' : (member.role ?? 'editor');
        const memberId = userByName.get(username.toLowerCase());
        if (memberId) await addMember(id, memberId, role);
      }

      for (const name of project.defaultTags ?? []) {
        const tagId = await ensureTag(name);
        await tx.insert(projectDefaultTags).values({ projectId: id, tagId }).onConflictDoNothing();
      }
    }

    for (const task of bundle.tasks) {
      const taskId = crypto.randomUUID();
      const projectId = task.project ? projectByName.get(task.project.toLowerCase()) : undefined;
      let assigneeId = resolveAssignee(task.assignee);
      const createdAt = task.createdAt != null ? new Date(task.createdAt) : new Date();

      // Keep the assignee-is-member invariant: an assignee in a project they do
      // not belong to is either joined ("add", the default) or dropped.
      if (assigneeId != null && projectId != null && task.assignee != null) {
        const members = membersByProject.get(projectId);
        if (!members?.has(assigneeId)) {
          const choice = memberResolution[task.assignee.toLowerCase()] ?? 'add';
          if (choice === 'unassign') {
            unassignedForMembership.add(task.assignee);
            assigneeId = undefined;
          } else {
            await addMember(projectId, assigneeId);
            result.membersAdded += 1;
          }
        }
      }

      await tx.insert(tasks).values({
        id: taskId,
        title: task.title,
        notes: task.notes ?? null,
        status: task.status,
        projectId: projectId ?? null,
        assigneeId: assigneeId ?? null,
        impact: task.impact,
        effort: task.effort,
        confidence: task.confidence,
        urgencyOverride: task.urgencyOverride ?? null,
        dueStartDate: task.dueStartDate ?? null,
        // Legacy backups only had a single dueDate; treat it as the end date.
        dueEndDate: task.dueEndDate ?? task.dueDate ?? null,
        manualRank: task.manualRank ?? null,
        createdBy: importerId,
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        completedAt: task.completedAt != null ? new Date(task.completedAt) : null,
      });
      result.tasksCreated += 1;

      for (const name of task.tags) {
        const tagId = await ensureTag(name);
        await tx.insert(taskTags).values({ taskId, tagId }).onConflictDoNothing();
      }

      // Subtasks are children of the task; recreate them in their exported order,
      // falling back to the array index when a position was not recorded.
      if (task.subtasks?.length) {
        await tx.insert(subtasks).values(
          task.subtasks.map((subtask, index) => ({
            id: crypto.randomUUID(),
            taskId,
            description: subtask.description,
            position: subtask.position ?? index,
            done: subtask.done ?? false,
          })),
        );
      }
    }
  });

  result.unassignedForMembership = [...unassignedForMembership].sort();

  if (bundle.scoring) await saveScoringSettings(db, bundle.scoring);

  return result;
}