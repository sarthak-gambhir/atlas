import type { IncomingMessage, ServerResponse } from 'node:http';

import { buildApp } from '../apps/server/src/app.ts';

/**
 * The whole API as one Vercel function. The Fastify instance is built once per
 * cold start and reused, so the database pool and the plugin graph survive
 * between invocations; only the request is handed over each time.
 *
 * Fastify never listens on a port here. Vercel gives us the raw Node request and
 * response, which we feed to Fastify's own HTTP server, letting its router,
 * hooks and error handling work exactly as they do locally.
 */
const app = buildApp();
const ready = app.ready();

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  await ready;
  app.server.emit('request', request, response);
}
