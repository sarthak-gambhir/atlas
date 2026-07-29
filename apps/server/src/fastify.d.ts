import type { Database } from './db/index.ts';
import type { Env } from './env.ts';
import type { UserRecord } from './repositories/users.ts';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    env: Env;
  }

  interface FastifyRequest {
    /** Populated by the session hook; null for anonymous requests. */
    user: UserRecord | null;
    /** Raw session cookie value, kept so logout can revoke it. */
    sessionToken: string | null;
  }
}
