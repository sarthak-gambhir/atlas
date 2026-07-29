import type { BackupBundle, ExportedTask, ImportResultDto } from '@atlas/shared';
import { eq } from 'drizzle-orm';

import type { Database } from './db/index.ts';
import { projects, tags, taskTags, tasks, users } from './db/schema.ts';
import { getScoringSettings, saveScoringSettings } from './repositories/settings.ts';

/** Everything a fresh database needs to look like this one, minus credentials. */
export async function buildBackup(db: Database): Promise<BackupBundle> {
  const [projectRows, taskRows, scoring] = await Promise.all([
    db.select().from(projects),
    db
      .select({ task: tasks, projectName: projects.name, assigneeUsername: users.username })
      .from(tasks)
      .leftJoin(projects, eq(projects.id, tasks.projectId))
      .leftJoin(users, eq(users.id, tasks.assigneeId)),
    getScoringSettings(db),
  ]);

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

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    scoring,
    projects: projectRows
      .map((project) => ({
        name: project.name,
        description: project.description,
        archived: project.archivedAt != null,
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
      dueDate: task.dueDate,
      estimateHours: task.estimateHours,
      manualRank: task.manualRank,
      tags: tagsByTask.get(task.id) ?? [],
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt?.toISOString() ?? null,
    })),
  };
}

/**
 * Restores a bundle. Projects, tags and assignees are matched by name, so a
 * bundle can be imported into a database whose ids differ. People are never
 * created: a task assigned to someone unknown here arrives unassigned, and the
 * caller is told which names were dropped.
 */
export async function restoreBackup(
  db: Database,
  bundle: BackupBundle,
  mode: 'merge' | 'replace',
  importerId: string,
): Promise<ImportResultDto> {
  const result: ImportResultDto = {
    projectsCreated: 0,
    tasksCreated: 0,
    tagsCreated: 0,
    unknownAssignees: [],
  };

  const usernames = new Set(
    bundle.tasks.map((task) => task.assignee?.toLowerCase()).filter((name) => name != null),
  );

  const knownUsers =
    usernames.size > 0
      ? await db.select({ id: users.id, username: users.username }).from(users)
      : [];
  const userByName = new Map(knownUsers.map((user) => [user.username.toLowerCase(), user.id]));

  const missing = [...usernames].filter((name) => !userByName.has(name));
  result.unknownAssignees = missing.sort();

  await db.transaction(async (tx) => {
    if (mode === 'replace') {
      // task_tags rows go with their tasks through the cascade.
      await tx.delete(tasks);
      await tx.delete(tags);
      await tx.delete(projects);
    }

    const projectByName = new Map(
      (await tx.select({ id: projects.id, name: projects.name }).from(projects)).map((row) => [
        row.name.toLowerCase(),
        row.id,
      ]),
    );

    for (const project of bundle.projects) {
      const key = project.name.toLowerCase();
      if (projectByName.has(key)) continue;

      const id = crypto.randomUUID();
      await tx.insert(projects).values({
        id,
        name: project.name,
        description: project.description ?? null,
        archivedAt: project.archived ? new Date() : null,
      });
      projectByName.set(key, id);
      result.projectsCreated += 1;
    }

    const tagByName = new Map(
      (await tx.select({ id: tags.id, name: tags.name }).from(tags)).map((row) => [
        row.name.toLowerCase(),
        row.id,
      ]),
    );

    for (const task of bundle.tasks) {
      const taskId = crypto.randomUUID();
      const projectId = task.project ? projectByName.get(task.project.toLowerCase()) : undefined;
      const assigneeId = task.assignee ? userByName.get(task.assignee.toLowerCase()) : undefined;
      const createdAt = task.createdAt != null ? new Date(task.createdAt) : new Date();

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
        dueDate: task.dueDate ?? null,
        estimateHours: task.estimateHours ?? null,
        manualRank: task.manualRank ?? null,
        createdBy: importerId,
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        completedAt: task.completedAt != null ? new Date(task.completedAt) : null,
      });
      result.tasksCreated += 1;

      for (const name of task.tags) {
        const key = name.toLowerCase();
        let tagId = tagByName.get(key);

        if (!tagId) {
          tagId = crypto.randomUUID();
          await tx.insert(tags).values({ id: tagId, name });
          tagByName.set(key, tagId);
          result.tagsCreated += 1;
        }

        await tx.insert(taskTags).values({ taskId, tagId }).onConflictDoNothing();
      }
    }
  });

  if (bundle.scoring) await saveScoringSettings(db, bundle.scoring);

  return result;
}