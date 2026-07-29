import type { onRequestAsyncHookHandler, preHandlerAsyncHookHandler } from 'fastify';

import { SESSION_COOKIE, loadSession } from './sessions.ts';

/**
 * Resolves the session cookie on every request. Anonymous requests simply carry
 * a null user; enforcement is the job of `requireAuth`.
 */
export const attachUser: onRequestAsyncHookHandler = async function attachUser(request) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return;

  const session = await loadSession(this.db, token);
  if (!session) return;

  request.user = session.user;
  request.sessionToken = token;
};

export const requireAuth: preHandlerAsyncHookHandler = async (request, reply) => {
  if (!request.user) {
    return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to continue.' });
  }
};

export const requireAdmin: preHandlerAsyncHookHandler = async (request, reply) => {
  if (!request.user) {
    return reply.code(401).send({ error: 'unauthorized', message: 'Sign in to continue.' });
  }
  if (request.user.role !== 'admin') {
    return reply
      .code(403)
      .send({ error: 'forbidden', message: 'This action requires an admin account.' });
  }
};
