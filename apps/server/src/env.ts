export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  /** Postgres connection string. Local Postgres in dev, Neon in production. */
  databaseUrl: string | undefined;
  /** Send the session cookie only over HTTPS. Off for plain-http local dev. */
  cookieSecure: boolean;
  /** Shared secret the Vercel cron request must present. */
  cronSecret: string | undefined;
}

function parseNodeEnv(value: string | undefined): Env['nodeEnv'] {
  if (value === 'production' || value === 'test') return value;
  return 'development';
}

function parsePort(value: string | undefined): number {
  if (value == null || value === '') return 8787;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${value}"`);
  }
  return port;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = parseNodeEnv(source.NODE_ENV);
  const isProduction = nodeEnv === 'production';

  return {
    nodeEnv,
    isProduction,
    port: parsePort(source.PORT),
    databaseUrl: source.DATABASE_URL,
    cookieSecure: source.ATLAS_COOKIE_SECURE != null ? source.ATLAS_COOKIE_SECURE === 'true' : isProduction,
    cronSecret: source.CRON_SECRET,
  };
}
