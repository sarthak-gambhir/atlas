import { sessionUserSchema, type ApiErrorBody, type SessionUser } from '@atlas/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { users } from '../db/schema.ts';
import { MAX_FAILURES } from '../repositories/login-attempts.ts';
import {
  TEST_PASSWORD,
  createTestContext,
  login,
  resetDatabase,
  seedUser,
  type TestContext,
} from '../test/helpers.ts';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.db);
});

describe('POST /api/auth/login', () => {
  it('returns the user and sets an http-only session cookie', async () => {
    await seedUser(ctx.db, { username: 'ada', displayName: 'Ada' });

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'ada', password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(200);
    const { user } = response.json<{ user: SessionUser }>();
    expect(sessionUserSchema.parse(user)).toMatchObject({
      username: 'ada',
      displayName: 'Ada',
      role: 'member',
    });

    const cookie = response.cookies.find((c) => c.name === 'atlas_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(cookie?.value).toBeTruthy();
  });

  it('matches the username case-insensitively', async () => {
    await seedUser(ctx.db, { username: 'ada' });

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'ADA', password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects a wrong password without a cookie', async () => {
    await seedUser(ctx.db, { username: 'ada' });

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'ada', password: 'wrong' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json<ApiErrorBody>().error).toBe('invalid_credentials');
    expect(response.cookies).toHaveLength(0);
  });

  it('gives the same answer for an unknown user as for a wrong password', async () => {
    await seedUser(ctx.db, { username: 'ada' });

    const [wrongPassword, unknownUser] = await Promise.all([
      ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'ada', password: 'wrong' },
      }),
      ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'nobody', password: 'wrong' },
      }),
    ]);

    expect(unknownUser.statusCode).toBe(wrongPassword.statusCode);
    expect(unknownUser.json<ApiErrorBody>()).toEqual(wrongPassword.json<ApiErrorBody>());
  });

  it('refuses a disabled account even with the right password', async () => {
    const user = await seedUser(ctx.db, { username: 'ada' });
    await ctx.db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, user.id));

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'ada', password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<ApiErrorBody>().error).toBe('account_disabled');
  });

  it('locks out after too many failures, and the lockout survives a correct password', async () => {
    await seedUser(ctx.db, { username: 'ada' });

    for (let attempt = 0; attempt < MAX_FAILURES; attempt += 1) {
      await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'ada', password: 'wrong' },
      });
    }

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'ada', password: TEST_PASSWORD },
    });

    expect(response.statusCode).toBe(429);
    expect(response.json<ApiErrorBody>().error).toBe('too_many_attempts');
  });

  it('rejects a malformed body with a validation error', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: '' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorBody>().error).toBe('validation_error');
    expect(response.json<ApiErrorBody>().issues ?? []).not.toHaveLength(0);
  });
});

describe('GET /api/auth/me', () => {
  it('is unauthorized without a session', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
  });

  it('returns the signed-in user', async () => {
    await seedUser(ctx.db, { username: 'ada', displayName: 'Ada', role: 'admin' });
    const cookie = await login(ctx.app, 'ada');

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ user: SessionUser }>().user).toMatchObject({ username: 'ada', role: 'admin' });
  });

  it('ignores a forged session cookie', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: 'atlas_session=made-up-token' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the session so the cookie stops working', async () => {
    await seedUser(ctx.db, { username: 'ada' });
    const cookie = await login(ctx.app, 'ada');

    const logout = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    });
    expect(logout.statusCode).toBe(200);

    const after = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    expect(after.statusCode).toBe(401);
  });

  it('is harmless without a session', async () => {
    const response = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout' });
    expect(response.statusCode).toBe(200);
  });
});
