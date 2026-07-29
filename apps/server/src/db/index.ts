import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.ts';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseHandle {
  db: Database;
  pool: pg.Pool;
  close: () => Promise<void>;
}

/**
 * One driver everywhere: `pg` against local Postgres in development and against
 * Neon's pooled endpoint in production. Neon also offers an HTTP driver, but it
 * cannot run interactive transactions, which would mean local and deployed code
 * behaving differently on exactly the writes that matter most.
 */
export function createDatabase(connectionString: string): DatabaseHandle {
  const pool = new pg.Pool({
    connectionString,
    // Serverless instances each hold their own pool, so keep them to a single
    // connection and let Neon's pooler do the multiplexing.
    max: process.env.VERCEL ? 1 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
    close: () => pool.end(),
  };
}

let cached: DatabaseHandle | undefined;

/** Reused across invocations on a warm serverless instance. */
export function getDatabase(connectionString: string): DatabaseHandle {
  cached ??= createDatabase(connectionString);
  return cached;
}

export { schema };
