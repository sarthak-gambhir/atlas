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
} from '../repositories/tasks.ts';

const taskParamsSchema = z.object({ id: z.uuid() });

export const taskRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  const context = async () => scoringContext(await getScoringSettings(app.db));

  app.get('/tasks', async (request) => {
    const filter = taskFilterSchema.parse(request.query);
    return { tasks: await listTasks(app.db, filter, await context()) };
  });

  app.post('/tasks', async (request, reply) => {
    const input = createTaskSchema.parse(request.body);
    const task = await createTask(app.db, input, request.user!.id, await context());
    return reply.code(201).send({ task });
  });

  app.get('/tasks/:id', async (request, reply) => {
    const { id } = taskParamsSchema.parse(request.params);
    const task = await getTask(app.db, id, await context());
    if (!task) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    return { task };
  });

  app.patch('/tasks/:id', async (request, reply) => {
    const { id } = taskParamsSchema.parse(request.params);
    const input = updateTaskSchema.parse(request.body);

    const task = await updateTask(app.db, id, input, await context());
    if (!task) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    return { task };
  });

  app.post('/tasks/:id/complete', async (request, reply) => {
    const { id } = taskParamsSchema.parse(request.params);

    const task = await updateTask(app.db, id, { status: 'done' }, await context());
    if (!task) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    return { task };
  });

  app.delete('/tasks/:id', async (request, reply) => {
    const { id } = taskParamsSchema.parse(request.params);

    const removed = await deleteTask(app.db, id);
    if (!removed) return reply.code(404).send({ error: 'not_found', message: 'No such task.' });
    return reply.code(204).send();
  });

  /** Status, project or assignee across a selection. Nothing else in bulk. */
  app.post('/tasks/bulk', async (request) => {
    const { ids, patch } = bulkUpdateSchema.parse(request.body);
    const updatedIds = await bulkUpdateTasks(app.db, ids, patch);

    return { updated: updatedIds.length, ids: updatedIds };
  });

  app.post('/tasks/reorder', async (request) => {
    const { orderedIds } = reorderSchema.parse(request.body);
    await reorderTasks(app.db, orderedIds);
    return { tasks: await listTasks(app.db, {}, await context()) };
  });
};
