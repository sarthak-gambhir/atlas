import {
  bulkUpdateSchema,
  createTaskSchema,
  reorderSchema,
  taskFilterSchema,
  updateTaskSchema,
} from '@atlas/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../auth/context.ts';
import { canEditProject, isProjectArchived, isProjectMember } from '../repositories/projects.ts';
import { getScoringSettings } from '../repositories/settings.ts';
import {
  bulkUpdateTasks,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  reorderTasks,
  scoringContext,
  updateTask,
  type TaskViewer,
} from '../repositories/tasks.ts';

const taskParamsSchema = z.object({ id: z.uuid() });

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  const context = async () => scoringContext(await getScoringSettings(app.db));

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
};
