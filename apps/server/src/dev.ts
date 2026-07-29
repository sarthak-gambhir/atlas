import { buildApp } from './app.ts';
import { loadEnv } from './env.ts';

const env = loadEnv();
const app = buildApp({ env });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: env.port, host: '127.0.0.1' });
