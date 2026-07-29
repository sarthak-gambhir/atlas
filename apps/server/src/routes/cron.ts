import { timingSafeEqual } from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

import { sweepExpiredSessions } from '../auth/sessions.ts';
import { pruneLoginAttempts } from '../repositories/login-attempts.ts';
import { pruneUnusedTags } from '../repositories/tags.ts';

function matchesSecret(header: string | undefined, secret: string): boolean {
  const offered = Buffer.from(header ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return offered.length === expected.length && timingSafeEqual(offered, expected);
}

/**
 * Housekeeping, driven by Vercel Cron once a day. Vercel sends the value of the
 * CRON_SECRET environment variable as a bearer token; with no secret set the
 * endpoint refuses to run rather than sitting open to the internet.
 */
export const cronRoutes: FastifyPluginAsync = async (app) => {
  app.get('/cron/sweep', async (request, reply) => {
    const secret = app.env.cronSecret;

    if (!secret) {
      return reply
        .code(503)
        .send({ error: 'cron_not_configured', message: 'CRON_SECRET is not set.' });
    }

    if (!matchesSecret(request.headers.authorization, secret)) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Bad cron credentials.' });
    }

    const sessionsRemoved = await sweepExpiredSessions(app.db);
    const loginAttemptsRemoved = await pruneLoginAttempts(app.db);
    const tagsRemoved = await pruneUnusedTags(app.db);

    request.log.info({ sessionsRemoved, loginAttemptsRemoved, tagsRemoved }, 'cron sweep');

    return { sessionsRemoved, loginAttemptsRemoved, tagsRemoved };
  });
};
