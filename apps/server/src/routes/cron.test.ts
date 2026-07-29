import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { hashToken } from '../auth/sessions.ts';
import { loginAttempts, sessions, tags } from '../db/schema.ts';
import { createTestContext, resetDatabase, seedUser, type TestContext } from '../test/helpers.ts';

const SECRET = 'cron-secret-for-tests';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext({ cronSecret: SECRET });
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.db);
});

interface SweepResult {
  sessionsRemoved: number;
  loginAttemptsRemoved: number;
  tagsRemoved: number;
}

function sweep(authorization?: string) {
  return ctx.app.inject({
    method: 'GET',
    url: '/api/cron/sweep',
    ...(authorization != null ? { headers: { authorization } } : {}),
  });
}

describe('GET /api/cron/sweep', () => {
  it('removes expired sessions, stale login attempts and orphaned tags', async () => {
    const user = await seedUser(ctx.db);
    const dayAgo = new Date(Date.now() - 26 * 60 * 60 * 1000);

    await ctx.db.insert(sessions).values([
      { id: hashToken('expired'), userId: user.id, expiresAt: dayAgo },
      {
        id: hashToken('live'),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    ]);

    await ctx.db.insert(loginAttempts).values([
      { id: crypto.randomUUID(), username: 'tester', succeeded: false, attemptedAt: dayAgo },
      { id: crypto.randomUUID(), username: 'tester', succeeded: false },
    ]);

    await ctx.db.insert(tags).values({ id: crypto.randomUUID(), name: 'orphan' });

    const response = await sweep(`Bearer ${SECRET}`);

    expect(response.statusCode).toBe(200);
    expect(response.json<SweepResult>()).toEqual({
      sessionsRemoved: 1,
      loginAttemptsRemoved: 1,
      tagsRemoved: 1,
    });

    // The live session must still work afterwards.
    const remaining = await ctx.db.select({ id: sessions.id }).from(sessions);
    expect(remaining).toHaveLength(1);
  });

  it('leaves a tag that is still in use', async () => {
    await seedUser(ctx.db, { username: 'ada', role: 'admin' });
    const cookie = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'ada', password: 'test-password-123' },
    });
    const session = cookie.cookies.find((c) => c.name === 'atlas_session');

    await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie: `atlas_session=${session?.value ?? ''}` },
      payload: { title: 'Tagged task', tags: ['keep-me'] },
    });

    const response = await sweep(`Bearer ${SECRET}`);
    expect(response.json<SweepResult>().tagsRemoved).toBe(0);
  });

  it('rejects a request with no credentials', async () => {
    expect((await sweep()).statusCode).toBe(401);
  });

  it('rejects a wrong secret', async () => {
    expect((await sweep('Bearer not-the-secret')).statusCode).toBe(401);
  });

  it('rejects a secret of a different length without leaking the comparison', async () => {
    expect((await sweep('Bearer short')).statusCode).toBe(401);
  });
});

describe('GET /api/cron/sweep without CRON_SECRET set', () => {
  it('refuses to run rather than staying open', async () => {
    const open = await createTestContext({ cronSecret: undefined });

    try {
      const response = await open.app.inject({ method: 'GET', url: '/api/cron/sweep' });
      expect(response.statusCode).toBe(503);
      expect(response.json<{ error: string }>().error).toBe('cron_not_configured');
    } finally {
      await open.close();
    }
  });
});
