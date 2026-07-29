/**
 * Drizzle wraps driver failures, so the Postgres SQLSTATE sits somewhere down
 * the `cause` chain rather than on the error we are handed.
 */
export function postgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;

  for (let depth = 0; current != null && depth < 5; depth += 1) {
    if (typeof current === 'object' && 'code' in current) {
      const { code } = current as { code?: unknown };
      // Fastify's own codes look like FST_ERR_*; SQLSTATEs are five characters.
      if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    }
    current = (current as { cause?: unknown }).cause;
  }

  return undefined;
}

export const PG_FOREIGN_KEY_VIOLATION = '23503';
export const PG_UNIQUE_VIOLATION = '23505';
