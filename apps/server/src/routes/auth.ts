import {
  changePasswordSchema,
  loginInputSchema,
  updateProfileSchema,
  usernameAvailabilityQuerySchema,
  type SessionUser,
} from '@atlas/shared';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';

import { requireAuth } from '../auth/context.ts';
import { isDemoUsername } from '../auth/demo.ts';
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

  /**
   * Availability probe for the profile editor. A username is "available" when
   * nobody else holds it (case-insensitively); the caller's own current name
   * always counts as free so re-casing or re-saving is not blocked.
   */
  app.get('/auth/username-available', { preHandler: requireAuth }, async (request) => {
    const parsed = usernameAvailabilityQuerySchema.safeParse(request.query);
    if (!parsed.success) return { available: false };

    const me = request.user!;
    // Only an admin may vouch for another account; everyone else is scoped to self.
    const exclude =
      parsed.data.excludeUserId && (me.role === 'admin' || parsed.data.excludeUserId === me.id)
        ? parsed.data.excludeUserId
        : me.id;

    const existing = await findUserByUsername(app.db, parsed.data.username);
    return { available: !existing || existing.id === exclude };
  });

  app.patch('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const { displayName, username } = updateProfileSchema.parse(request.body);
    const me = request.user!;

    // The shared demo login is frozen: no profile edits, so it stays consistent
    // for the next visitor (and keeps its locked username and password valid).
    if (isDemoUsername(me.username)) {
      return reply
        .code(403)
        .send({ error: 'demo_locked', message: 'The demo account profile cannot be edited.' });
    }

    // Guard the case-insensitive unique index before touching the row.
    const clash = await findUserByUsername(app.db, username);
    if (clash && clash.id !== me.id) {
      return reply.code(409).send({ error: 'already_exists', message: 'That username is taken.' });
    }

    const updated = await updateUser(app.db, me.id, { displayName, username });

    if (!updated) {
      return reply.code(404).send({ error: 'not_found', message: 'Account no longer exists.' });
    }

    return { user: toSessionUser(updated) };
  });

  app.post('/auth/logout-others', { preHandler: requireAuth }, async (request, reply) => {
    // Shared demo account: one visitor must not sign everyone else out.
    if (isDemoUsername(request.user!.username)) {
      return reply.code(403).send({
        error: 'demo_locked',
        message: 'The demo account cannot sign out other devices.',
      });
    }

    if (request.sessionToken) {
      await revokeOtherSessionsForUser(app.db, request.user!.id, request.sessionToken);
    }
    return { ok: true as const };
  });

  app.post('/auth/password', { preHandler: requireAuth }, async (request, reply) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
    const me = request.user!;

    // The demo account is shared: changing its password would lock everyone else out.
    if (isDemoUsername(me.username)) {
      return reply.code(403).send({
        error: 'demo_locked',
        message: "The demo account's password cannot be changed.",
      });
    }

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
