import {
  bulkUpdateSchema,
  createSubtaskSchema,
  createTaskSchema,
  reorderSchema,
  taskFilterSchema,
  updateSubtaskSchema,
  updateTaskSchema,
  type TaskDto,
} from '@atlas/shared';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../auth/context.ts';
import { recordAudit } from '../repositories/audit.ts';
import { canEditProject, isProjectArchived, isProjectMember } from '../repositories/projects.ts';
import { getScoringSettings } from '../repositories/settings.ts';
import {
  bulkUpdateTasks,
  createSubtask,
  createTask,
  deleteSubtask,
  deleteTask,
  findSubtaskParent,
  getTask,
  listTasks,
  reorderTasks,
  scoringContext,
  updateSubtask,
  updateTask,
  type TaskViewer,
} from '../repositories/tasks.ts';

const taskParamsSchema = z.object({ id: z.uuid() });
const subtaskParamsSchema = z.object({ id: z.uuid() });

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  const context = async () => scoringContext(await getScoringSettings(app.db));

  /**
   * Resolves a task the caller is allowed to modify, applying the same gate as
   * `PATCH /tasks/:id`: it must be visible, in a project they can edit, and
   * neither the project nor the task archived. Replies and returns null on any
   * failure. Used by the subtask routes so a checklist edit obeys task rules.
   */
  const requireEditableTask = async (
    request: FastifyRequest,
    reply: FastifyReply,
    id: string,
  ): Promise<TaskDto | null> => {
    const viewer: TaskViewer = { id: request.user!.id, role: request.user!.role };
    const existing = await getTask(app.db, id, await context());
    if (!existing) {
      reply.code(404).send({ error: 'not_found', message: 'No such task.' });
      return null;
    }
    if (
      viewer.role !== 'admin' &&
      existing.projectId != null &&
      !(await isProjectMember(app.db, existing.projectId, viewer.id))
    ) {
      reply.code(404).send({ error: 'not_found', message: 'No such task.' });
      return null;
    }
    if (existing.projectId != null && !(await canEditProject(app.db, existing.projectId, viewer))) {
      reply.code(403).send({
        error: 'forbidden',
        message: 'You have view-only access to that project.',
      });
      return null;
    }
    if (existing.projectId != null && (await isProjectArchived(app.db, existing.projectId))) {
      reply.code(409).send({
        error: 'project_archived',
        message: 'That project is archived. Restore it to edit its tasks.',
      });
      return null;
    }
    if (existing.status === 'archived') {
      reply.code(409).send({
        error: 'task_archived',
        message: 'Restore the task before editing it.',
      });
      return null;
    }
    return existing;
  };

  app.get('/tasks', async (request) => {
    const filter = taskFilterSchema.parse(request.query);
    const viewer: TaskViewer = { id: request.user!.id, role: request.user!.role };
    return { tasks: await listTasks(app.db, filter, await context(), viewer) };
  });

  app.post('/tasks', async (request, reply) => {
    const input = createTaskSchema.parse(request.body);
    const viewer: TaskViewer = { id: request.user!.id, role: request.user!.role };

    if (input.projectId != null) {
      if (!(await canEditProject(app.db, input.projectId, viewer))) {
        return reply.code(403).send({
          error: 'forbidden',
          message: 'You have view-only access to that project.',
        });
      }
      if (await isProjectArchived(app.db, input.projectId)) {
        return reply.code(409).send({
          error: 'project_archived',
          message: 'That project is archived. Restore it before adding tasks.',
        });
      }
      if (
        input.assigneeId != null &&
        !(await isProjectMember(app.db, input.projectId, input.assigneeId))
      ) {
        return reply.code(400).send({
          error: 'assignee_not_member',
          message: 'The assignee must be a member of the task\u2019s project.',
        });
      }
    }

    const task = await createTask(app.db, input, request.user!.id, await context());
    await recordAudit(app.db, {
      actor: { id: request.user!.id, username: request.user!.username },
      action: 'task.create',
      entityType: 'task',
      entityId: task.id,
      projectId: task.projectId,
      metadata: { title: task.title },
    });
    return reply.code(201).send({ task });
  });

  app.get('/tasks/:id', async (request, reply) => {
    const { id } = taskParamsSchema.parse(request.params);
    const task = await getTask(app.db, id, await context());
    if (!task) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });

    if (
      request.user!.role !== 'admin' &&
      task.projectId != null &&
      !(await isProjectMember(app.db, task.projectId, request.user!.id))
    ) {
      return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    }

    return { task };
  });

  app.patch('/tasks/:id', async (request, reply) => {
    const { id } = taskParamsSchema.parse(request.params);
    const input = updateTaskSchema.parse(request.body);
    const viewer: TaskViewer = { id: request.user!.id, role: request.user!.role };

    const existing = await getTask(app.db, id, await context());
    if (!existing) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });

    // A member can only touch a task they can see.
    if (
      viewer.role !== 'admin' &&
      existing.projectId != null &&
      !(await isProjectMember(app.db, existing.projectId, viewer.id))
    ) {
      return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    }

    // Viewers may see a project's tasks but not edit them.
    if (existing.projectId != null && !(await canEditProject(app.db, existing.projectId, viewer))) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'You have view-only access to that project.',
      });
    }

    // Tasks in an archived project are read-only; restore the project first.
    if (existing.projectId != null && (await isProjectArchived(app.db, existing.projectId))) {
      return reply.code(409).send({
        error: 'project_archived',
        message: 'That project is archived. Restore it to edit its tasks.',
      });
    }

    // An archived task accepts only a status change that restores it.
    if (existing.status === 'archived') {
      const keys = Object.keys(input);
      const onlyStatus = keys.length > 0 && keys.every((key) => key === 'status');
      if (!onlyStatus || input.status == null || input.status === 'archived') {
        return reply.code(409).send({
          error: 'task_archived',
          message: 'Restore the task before editing it.',
        });
      }
    }

    // Moving into a project requires access to it, and it must not be archived.
    if (input.projectId != null && input.projectId !== existing.projectId) {
      if (await isProjectArchived(app.db, input.projectId)) {
        return reply.code(409).send({
          error: 'project_archived',
          message: 'That project is archived.',
        });
      }
      if (!(await canEditProject(app.db, input.projectId, viewer))) {
        return reply.code(403).send({
          error: 'forbidden',
          message: 'You have view-only access to that project.',
        });
      }
    }

    // The resulting assignee must belong to the resulting project.
    const resultingProject = input.projectId !== undefined ? input.projectId : existing.projectId;
    const resultingAssignee =
      input.assigneeId !== undefined ? input.assigneeId : existing.assigneeId;
    if (
      resultingProject != null &&
      resultingAssignee != null &&
      !(await isProjectMember(app.db, resultingProject, resultingAssignee))
    ) {
      return reply.code(400).send({
        error: 'assignee_not_member',
        message: 'The assignee must be a member of the task\u2019s project.',
      });
    }

    const task = await updateTask(app.db, id, input, await context());
    if (!task) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    await recordAudit(app.db, {
      actor: { id: request.user!.id, username: request.user!.username },
      action: 'task.update',
      entityType: 'task',
      entityId: task.id,
      projectId: task.projectId,
      metadata: { fields: Object.keys(input) },
    });
    return { task };
  });

  app.post('/tasks/:id/complete', async (request, reply) => {
    const { id } = taskParamsSchema.parse(request.params);
    const viewer: TaskViewer = { id: request.user!.id, role: request.user!.role };

    const existing = await getTask(app.db, id, await context());
    if (!existing) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });

    if (
      viewer.role !== 'admin' &&
      existing.projectId != null &&
      !(await isProjectMember(app.db, existing.projectId, viewer.id))
    ) {
      return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    }

    if (existing.projectId != null && !(await canEditProject(app.db, existing.projectId, viewer))) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'You have view-only access to that project.',
      });
    }

    if (existing.status === 'archived') {
      return reply.code(409).send({
        error: 'task_archived',
        message: 'Restore the task before completing it.',
      });
    }
    if (existing.projectId != null && (await isProjectArchived(app.db, existing.projectId))) {
      return reply.code(409).send({
        error: 'project_archived',
        message: 'That project is archived. Restore it to change its tasks.',
      });
    }

    const task = await updateTask(app.db, id, { status: 'done' }, await context());
    if (!task) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    await recordAudit(app.db, {
      actor: { id: request.user!.id, username: request.user!.username },
      action: 'task.complete',
      entityType: 'task',
      entityId: task.id,
      projectId: task.projectId,
      metadata: { title: task.title },
    });
    return { task };
  });

  app.delete('/tasks/:id', async (request, reply) => {
    const { id } = taskParamsSchema.parse(request.params);
    const viewer: TaskViewer = { id: request.user!.id, role: request.user!.role };

    const existing = await getTask(app.db, id, await context());
    if (!existing) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });

    // Non-members cannot see the task; viewers can see but not delete.
    if (
      viewer.role !== 'admin' &&
      existing.projectId != null &&
      !(await isProjectMember(app.db, existing.projectId, viewer.id))
    ) {
      return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    }
    if (existing.projectId != null && !(await canEditProject(app.db, existing.projectId, viewer))) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'You have view-only access to that project.',
      });
    }

    const removed = await deleteTask(app.db, id);
    if (!removed) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    await recordAudit(app.db, {
      actor: { id: request.user!.id, username: request.user!.username },
      action: 'task.delete',
      entityType: 'task',
      entityId: id,
      projectId: existing.projectId,
      metadata: { title: existing.title },
    });
    return reply.code(204).send();
  });

  /** Status, project or assignee across a selection. Nothing else in bulk. */
  app.post('/tasks/bulk', async (request, reply) => {
    const { ids, patch } = bulkUpdateSchema.parse(request.body);
    const viewer: TaskViewer = { id: request.user!.id, role: request.user!.role };

    // A non-null target project must be reachable and open for the whole request.
    if (patch.projectId != null) {
      if (await isProjectArchived(app.db, patch.projectId)) {
        return reply.code(409).send({
          error: 'project_archived',
          message: 'That project is archived.',
        });
      }
      if (!(await canEditProject(app.db, patch.projectId, viewer))) {
        return reply.code(403).send({
          error: 'forbidden',
          message: 'You have view-only access to that project.',
        });
      }
    }

    const outcome = await bulkUpdateTasks(app.db, ids, patch, viewer);
    if (outcome.ids.length > 0) {
      await recordAudit(app.db, {
        actor: { id: request.user!.id, username: request.user!.username },
        action: 'task.bulk_update',
        entityType: 'task',
        projectId: patch.projectId ?? null,
        metadata: { count: outcome.ids.length, fields: Object.keys(patch) },
      });
    }
    return {
      updated: outcome.ids.length,
      ids: outcome.ids,
      skipped: outcome.skipped,
      reasons: outcome.reasons,
    };
  });

  app.post('/tasks/reorder', async (request) => {
    const { orderedIds } = reorderSchema.parse(request.body);
    const viewer: TaskViewer = { id: request.user!.id, role: request.user!.role };
    await reorderTasks(app.db, orderedIds);
    return { tasks: await listTasks(app.db, {}, await context(), viewer) };
  });

  app.post('/tasks/:id/subtasks', async (request, reply) => {
    const { id } = taskParamsSchema.parse(request.params);
    const input = createSubtaskSchema.parse(request.body);

    const parent = await requireEditableTask(request, reply, id);
    if (parent == null) return reply;

    const subtask = await createSubtask(app.db, id, input);
    await recordAudit(app.db, {
      actor: { id: request.user!.id, username: request.user!.username },
      action: 'task.update',
      entityType: 'subtask',
      entityId: subtask.id,
      projectId: parent.projectId,
      metadata: { taskId: id, subtask: 'add', description: subtask.description },
    });
    return reply.code(201).send({ subtask });
  });

  app.patch('/subtasks/:id', async (request, reply) => {
    const { id } = subtaskParamsSchema.parse(request.params);
    const input = updateSubtaskSchema.parse(request.body);

    const taskId = await findSubtaskParent(app.db, id);
    if (taskId == null) {
      return reply.code(404).send({ error: 'not_found', message: 'No such subtask.' });
    }
    const parent = await requireEditableTask(request, reply, taskId);
    if (parent == null) return reply;

    const subtask = await updateSubtask(app.db, id, input);
    if (!subtask) return reply.code(404).send({ error: 'not_found', message: 'No such subtask.' });
    await recordAudit(app.db, {
      actor: { id: request.user!.id, username: request.user!.username },
      action: 'task.update',
      entityType: 'subtask',
      entityId: subtask.id,
      projectId: parent.projectId,
      metadata: { taskId, subtask: 'update', fields: Object.keys(input) },
    });
    return { subtask };
  });

  app.delete('/subtasks/:id', async (request, reply) => {
    const { id } = subtaskParamsSchema.parse(request.params);

    const taskId = await findSubtaskParent(app.db, id);
    if (taskId == null) {
      return reply.code(404).send({ error: 'not_found', message: 'No such subtask.' });
    }
    const parent = await requireEditableTask(request, reply, taskId);
    if (parent == null) return reply;

    await deleteSubtask(app.db, id);
    await recordAudit(app.db, {
      actor: { id: request.user!.id, username: request.user!.username },
      action: 'task.update',
      entityType: 'subtask',
      entityId: id,
      projectId: parent.projectId,
      metadata: { taskId, subtask: 'delete' },
    });
    return reply.code(204).send();
  });
};
