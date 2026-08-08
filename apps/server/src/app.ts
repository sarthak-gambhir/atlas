import cookie from '@fastify/cookie';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { attachUser } from './auth/context.ts';
import { getDatabase, type Database } from './db/index.ts';
import { loadEnv, type Env } from './env.ts';
import { PG_FOREIGN_KEY_VIOLATION, PG_UNIQUE_VIOLATION, postgresErrorCode } from './errors.ts';
import { auditRoutes } from './routes/audit.ts';
import { authRoutes } from './routes/auth.ts';
import { cronRoutes } from './routes/cron.ts';
import { dataRoutes } from './routes/data.ts';
import { healthRoutes } from './routes/health.ts';
import { organizationRoutes } from './routes/projects.ts';
import { settingsRoutes } from './routes/settings.ts';
import { taskRoutes } from './routes/tasks.ts';
import { userRoutes } from './routes/users.ts';

export interface BuildAppOptions {
  env?: Env;
  db?: Database;
  logger?: boolean;
}

function resolveDatabase(env: Env): Database {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
  }
  return getDatabase(env.databaseUrl).db;
}

/**
 * Builds the API. Used by the local dev listener, by the Vercel function and by
 * tests through `app.inject()`, so nothing here may assume a long-lived process.
 */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const env = options.env ?? loadEnv();
  const db = options.db ?? resolveDatabase(env);

  const app = Fastify({
    logger: options.logger ?? env.nodeEnv !== 'test',
    // Vercel terminates TLS upstream, so the client IP and protocol arrive in headers.
    trustProxy: true,
    bodyLimit: 1_048_576,
  });

  app.decorate('env', env);
  app.decorate('db', db);
  app.decorateRequest('user', null);
  app.decorateRequest('sessionToken', null);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_error',
        message: 'The request is invalid.',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const sqlState = postgresErrorCode(error);

    // A bad projectId or assigneeId is a client mistake, not a server fault.
    if (sqlState === PG_FOREIGN_KEY_VIOLATION) {
      return reply.code(400).send({
        error: 'invalid_reference',
        message: 'That project or user does not exist.',
      });
    }

    if (sqlState === PG_UNIQUE_VIOLATION) {
      return reply.code(409).send({
        error: 'already_exists',
        message: 'Something with that name already exists.',
      });
    }

    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'unhandled error');
      return reply.code(status).send({
        error: 'internal_error',
        message: 'Something went wrong.',
      });
    }

    return reply.code(status).send({ error: 'request_error', message: error.message });
  });

  // Registered first so its cookie-parsing hook runs before the session lookup.
  app.register(cookie);

  app.register(
    async (api) => {
      api.addHook('onRequest', attachUser);
      api.setNotFoundHandler(async (_request, reply) =>
        reply.code(404).send({ error: 'not_found', message: 'No such endpoint.' }),
      );

      await api.register(healthRoutes);
      await api.register(cronRoutes);
      await api.register(authRoutes);
      await api.register(taskRoutes);
      await api.register(organizationRoutes);
      await api.register(userRoutes);
      await api.register(settingsRoutes);
      await api.register(dataRoutes);
      await api.register(auditRoutes);
    },
    { prefix: '/api' },
  );

  return app;
}
