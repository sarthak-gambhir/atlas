import { createProjectSchema, updateProjectSchema } from '@atlas/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { requireAdmin, requireAuth } from '../auth/context.ts';
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from '../repositories/projects.ts';
import { listTags } from '../repositories/tags.ts';

const idParamsSchema = z.object({ id: z.uuid() });
const listQuerySchema = z.object({
  includeArchived: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((value) => value === true || value === 'true')
    .optional(),
});

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get('/projects', async (request) => {
    const { includeArchived } = listQuerySchema.parse(request.query);
    return { projects: await listProjects(app.db, includeArchived) };
  });

  app.post('/projects', async (request, reply) => {
    const input = createProjectSchema.parse(request.body);
    return reply.code(201).send({ project: await createProject(app.db, input) });
  });

  app.patch('/projects/:id', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const input = updateProjectSchema.parse(request.body);

    const project = await updateProject(app.db, id, input);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    return { project };
  });

  app.delete('/projects/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);

    const removed = await deleteProject(app.db, id);
    if (!removed) return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    return reply.code(204).send();
  });

  app.get('/tags', async () => ({ tags: await listTags(app.db) }));
};
