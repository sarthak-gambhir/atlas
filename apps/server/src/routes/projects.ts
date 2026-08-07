import {
  addProjectMemberSchema,
  createProjectSchema,
  updateMemberRoleSchema,
  updateProjectSchema,
} from '@atlas/shared';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { requireAdmin, requireAuth } from '../auth/context.ts';
import {
  addProjectMember,
  createProject,
  deleteProject,
  getProject,
  getProjectAuth,
  isProjectMember,
  listProjects,
  removeProjectMember,
  setProjectFavorite,
  transferProjectOwnership,
  updateMemberRole,
  updateProject,
} from '../repositories/projects.ts';
import { listTags } from '../repositories/tags.ts';
import { findUserById } from '../repositories/users.ts';

const idParamsSchema = z.object({ id: z.uuid() });
const memberParamsSchema = z.object({ id: z.uuid(), userId: z.uuid() });
const favoriteSchema = z.object({ favorite: z.boolean() });
const listQuerySchema = z.object({
  includeArchived: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((value) => value === true || value === 'true')
    .optional(),
});

export const organizationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  /** Resolves the project and enforces owner-or-admin; replies and returns null on failure. */
  const requireManageable = async (
    request: FastifyRequest,
    reply: FastifyReply,
    id: string,
  ): Promise<true | null> => {
    const auth = await getProjectAuth(app.db, id);
    if (!auth) {
      reply.code(404).send({ error: 'not_found', message: 'No such project.' });
      return null;
    }
    if (request.user!.role !== 'admin' && auth.ownerId !== request.user!.id) {
      reply.code(403).send({
        error: 'forbidden',
        message: 'Only the project owner or an admin can change this project.',
      });
      return null;
    }
    return true;
  };

  app.get('/projects', async (request) => {
    const { includeArchived } = listQuerySchema.parse(request.query);
    const viewer = { id: request.user!.id, role: request.user!.role };
    return { projects: await listProjects(app.db, viewer, includeArchived) };
  });

  app.get('/projects/:id', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const viewer = { id: request.user!.id, role: request.user!.role };
    const project = await getProject(app.db, id, viewer);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    return { project };
  });

  app.post('/projects', async (request, reply) => {
    const input = createProjectSchema.parse(request.body);

    // At creation the only member is the creator, so any default assignee must be them.
    if (input.defaults?.assigneeId != null && input.defaults.assigneeId !== request.user!.id) {
      return reply.code(400).send({
        error: 'assignee_not_member',
        message: 'A default assignee must be a member of the project.',
      });
    }

    return reply.code(201).send({ project: await createProject(app.db, input, request.user!.id) });
  });

  app.patch('/projects/:id', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const input = updateProjectSchema.parse(request.body);

    if ((await requireManageable(request, reply, id)) == null) return reply;

    if (
      input.defaults?.assigneeId != null &&
      !(await isProjectMember(app.db, id, input.defaults.assigneeId))
    ) {
      return reply.code(400).send({
        error: 'assignee_not_member',
        message: 'A default assignee must be a member of the project.',
      });
    }

    const project = await updateProject(app.db, id, input);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    return { project };
  });

  app.post('/projects/:id/members', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { userId, role } = addProjectMemberSchema.parse(request.body);

    if ((await requireManageable(request, reply, id)) == null) return reply;

    if (!(await findUserById(app.db, userId))) {
      return reply.code(404).send({ error: 'not_found', message: 'No such user.' });
    }

    const project = await addProjectMember(app.db, id, userId, role);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    return { project };
  });

  app.patch('/projects/:id/members/:userId', async (request, reply) => {
    const { id, userId } = memberParamsSchema.parse(request.params);
    const { role } = updateMemberRoleSchema.parse(request.body);

    const auth = await getProjectAuth(app.db, id);
    if (!auth) return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    if (request.user!.role !== 'admin' && auth.ownerId !== request.user!.id) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'Only the project owner or an admin can change this project.',
      });
    }
    if (auth.ownerId === userId) {
      return reply.code(409).send({
        error: 'cannot_change_owner_role',
        message: 'The owner outranks all roles. Transfer ownership to change it.',
      });
    }

    const project = await updateMemberRole(app.db, id, userId, role);
    if (!project) {
      return reply.code(404).send({ error: 'not_found', message: 'No such project member.' });
    }
    return { project };
  });

  app.post('/projects/:id/owner', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { userId } = addProjectMemberSchema.parse(request.body);

    if ((await requireManageable(request, reply, id)) == null) return reply;

    if (!(await findUserById(app.db, userId))) {
      return reply.code(404).send({ error: 'not_found', message: 'No such user.' });
    }

    const project = await transferProjectOwnership(app.db, id, userId);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    return { project };
  });

  app.delete('/projects/:id/members/:userId', async (request, reply) => {
    const { id, userId } = memberParamsSchema.parse(request.params);

    const auth = await getProjectAuth(app.db, id);
    if (!auth) return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    if (request.user!.role !== 'admin' && auth.ownerId !== request.user!.id) {
      return reply.code(403).send({
        error: 'forbidden',
        message: 'Only the project owner or an admin can change this project.',
      });
    }
    if (auth.ownerId === userId) {
      return reply.code(409).send({
        error: 'cannot_remove_owner',
        message: 'The owner is always a member. Transfer ownership first.',
      });
    }

    const project = await removeProjectMember(app.db, id, userId);
    if (!project) return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    return { project };
  });

  app.put('/projects/:id/favorite', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const { favorite } = favoriteSchema.parse(request.body);
    const viewer = { id: request.user!.id, role: request.user!.role };

    // Favoriting requires only that the caller can see the project.
    const existing = await getProject(app.db, id, viewer);
    if (!existing) {
      return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    }

    await setProjectFavorite(app.db, id, viewer.id, favorite);
    return { project: await getProject(app.db, id, viewer) };
  });

  app.delete('/projects/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);

    const removed = await deleteProject(app.db, id);
    if (!removed) return reply.code(404).send({ error: 'not_found', message: 'No such project.' });
    return reply.code(204).send();
  });

  app.get('/tags', async () => ({ tags: await listTags(app.db) }));
};
