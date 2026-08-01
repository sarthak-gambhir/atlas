import { createUserSchema, updateUserSchema, type UserSummaryDto } from '@atlas/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { requireAdmin, requireAuth } from '../auth/context.ts';
import { hashPassword } from '../auth/password.ts';
import { revokeAllSessionsForUser } from '../auth/sessions.ts';
import {
  countActiveAdmins,
  createUser,
  deleteUser,
  findUserById,
  findUserByUsername,
  listUsers,
  updateUser,
  type UserRecord,
} from '../repositories/users.ts';

const idParamsSchema = z.object({ id: z.uuid() });

function toSummary(user: UserRecord): UserSummaryDto {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    disabled: user.disabledAt != null,
    createdAt: user.createdAt,
  };
}

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  /** Everyone can see the (small) list of people, to assign work. */
  app.get('/users', async () => {
    const users = await listUsers(app.db);
    return { users: users.map(toSummary) };
  });

  app.post('/users', { preHandler: requireAdmin }, async (request, reply) => {
    const input = createUserSchema.parse(request.body);

    if (await findUserByUsername(app.db, input.username)) {
      return reply
        .code(409)
        .send({ error: 'already_exists', message: 'That username is taken.' });
    }

    const user = await createUser(app.db, {
      username: input.username,
      displayName: input.displayName,
      passwordHash: await hashPassword(input.password),
      role: input.role ?? 'member',
    });

    return reply.code(201).send({ user: toSummary(user) });
  });

  app.patch('/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const input = updateUserSchema.parse(request.body);

    const target = await findUserById(app.db, id);
    if (!target) return reply.code(404).send({ error: 'not_found', message: 'No such user.' });

    if (input.username !== undefined) {
      const clash = await findUserByUsername(app.db, input.username);
      if (clash && clash.id !== id) {
        return reply
          .code(409)
          .send({ error: 'already_exists', message: 'That username is taken.' });
      }
    }

    // Locking yourself out is never the intent.
    if (input.disabled === true && target.id === request.user!.id) {
      return reply.code(400).send({
        error: 'cannot_disable_self',
        message: 'You cannot disable your own account.',
      });
    }

    const wouldLoseAdmin =
      target.role === 'admin' &&
      target.disabledAt == null &&
      ((input.role != null && input.role !== 'admin') || input.disabled === true);

    if (wouldLoseAdmin && (await countActiveAdmins(app.db)) <= 1) {
      return reply.code(409).send({
        error: 'last_admin',
        message: 'Promote another admin first: Atlas needs at least one.',
      });
    }

    const updated = await updateUser(app.db, id, {
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.disabled !== undefined ? { disabled: input.disabled } : {}),
      ...(input.password !== undefined
        ? { passwordHash: await hashPassword(input.password) }
        : {}),
    });

    if (!updated) return reply.code(404).send({ error: 'not_found', message: 'No such user.' });

    // A reset password or a disabled account must not leave live sessions behind.
    if (input.password !== undefined || input.disabled === true) {
      await revokeAllSessionsForUser(app.db, id);
    }

    return { user: toSummary(updated) };
  });

  app.delete('/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);

    if (id === request.user!.id) {
      return reply
        .code(400)
        .send({ error: 'cannot_delete_self', message: 'You cannot delete your own account.' });
    }

    const target = await findUserById(app.db, id);
    if (!target) return reply.code(404).send({ error: 'not_found', message: 'No such user.' });

    if (target.disabledAt == null) {
      return reply.code(409).send({
        error: 'must_disable_first',
        message: 'Disable the account before deleting it.',
      });
    }

    await deleteUser(app.db, id, request.user!.id);
    return { ok: true as const };
  });
};
