import { changePasswordSchema, loginInputSchema, type SessionUser } from '@atlas/shared';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';

import { requireAuth } from '../auth/context.ts';
import { fakeVerify, hashPassword, verifyPassword } from '../auth/password.ts';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  revokeOtherSessionsForUser,
  revokeSession,
} from '../auth/sessions.ts';
import {
  MAX_FAILURES,
  countRecentFailures,
  recordLoginAttempt,
} from '../repositories/login-attempts.ts';
import { findUserByUsername, updateUser } from '../repositories/users.ts';
import type { UserRecord } from '../repositories/users.ts';

function toSessionUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

/** One deliberately vague message, so a failure never reveals which half was wrong. */
function invalidCredentials(reply: FastifyReply) {
  return reply
    .code(401)
    .send({ error: 'invalid_credentials', message: 'Incorrect username or password.' });
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/login', async (request, reply) => {
    const { username, password } = loginInputSchema.parse(request.body);

    if ((await countRecentFailures(app.db, username)) >= MAX_FAILURES) {
      return reply.code(429).send({
        error: 'too_many_attempts',
        message: 'Too many failed sign-in attempts. Try again in a few minutes.',
      });
    }

    const user = await findUserByUsername(app.db, username);

    if (!user) {
      // Spend comparable time so response latency does not disclose the account.
      await fakeVerify();
      await recordLoginAttempt(app.db, username, false);
      return invalidCredentials(reply);
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      await recordLoginAttempt(app.db, username, false);
      return invalidCredentials(reply);
    }

    if (user.disabledAt) {
      await recordLoginAttempt(app.db, username, false);
      return reply
        .code(403)
        .send({ error: 'account_disabled', message: 'This account has been disabled.' });
    }

    const { token } = await createSession(app.db, user.id);
    await recordLoginAttempt(app.db, username, true);

    return reply
      .setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: app.env.cookieSecure,
        path: '/',
        maxAge: SESSION_TTL_MS / 1000,
      })
      .send({ user: toSessionUser(user) });
  });

  app.post('/auth/logout', async (request, reply) => {
    if (request.sessionToken) {
      await revokeSession(app.db, request.sessionToken);
    }
    return reply.clearCookie(SESSION_COOKIE, { path: '/' }).send({ ok: true });
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => ({
    // requireAuth guarantees a user; the non-null assertion keeps the type honest.
    user: toSessionUser(request.user!),
  }));

  app.post('/auth/password', { preHandler: requireAuth }, async (request, reply) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
    const me = request.user!;

    const stored = await findUserByUsername(app.db, me.username);
    if (!stored || !(await verifyPassword(currentPassword, stored.passwordHash))) {
      return reply
        .code(401)
        .send({ error: 'invalid_credentials', message: 'Current password is incorrect.' });
    }

    await updateUser(app.db, me.id, { passwordHash: await hashPassword(newPassword) });

    // Anything else holding a session used the old password.
    if (request.sessionToken) {
      await revokeOtherSessionsForUser(app.db, me.id, request.sessionToken);
    }

    return { ok: true };
  });
};
