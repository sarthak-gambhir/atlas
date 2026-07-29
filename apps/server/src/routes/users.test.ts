import type { ApiErrorBody, UserSummaryDto } from '@atlas/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  TEST_PASSWORD,
  createTestContext,
  login,
  resetDatabase,
  seedUser,
  type TestContext,
} from '../test/helpers.ts';

let ctx: TestContext;
let adminCookie: string;
let memberCookie: string;
let memberId: string;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.db);
  await seedUser(ctx.db, { username: 'ada', displayName: 'Ada', role: 'admin' });
  const member = await seedUser(ctx.db, { username: 'grace', displayName: 'Grace' });
  memberId = member.id;
  adminCookie = await login(ctx.app, 'ada');
  memberCookie = await login(ctx.app, 'grace');
});

describe('POST /api/users', () => {
  it('lets an admin create an account that can then sign in', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: adminCookie },
      payload: { username: 'linus', displayName: 'Linus', password: 'another-password' },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json<{ user: UserSummaryDto }>().user).toMatchObject({
      username: 'linus',
      role: 'member',
      disabled: false,
    });

    await expect(login(ctx.app, 'linus', 'another-password')).resolves.toContain('atlas_session=');
  });

  it('refuses a member', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: memberCookie },
      payload: { username: 'linus', displayName: 'Linus', password: 'another-password' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('refuses a duplicate username regardless of casing', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: adminCookie },
      payload: { username: 'GRACE', displayName: 'Impostor', password: 'another-password' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('refuses a short password', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: adminCookie },
      payload: { username: 'linus', displayName: 'Linus', password: 'short' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorBody>().error).toBe('validation_error');
  });
});

describe('PATCH /api/users/:id', () => {
  it('resets a password and signs that user out everywhere', async () => {
    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${memberId}`,
      headers: { cookie: adminCookie },
      payload: { password: 'brand-new-password' },
    });
    expect(response.statusCode).toBe(200);

    const stale = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: memberCookie },
    });
    expect(stale.statusCode).toBe(401);

    await expect(login(ctx.app, 'grace', 'brand-new-password')).resolves.toBeTruthy();
  });

  it('disables an account, blocking both the live session and a fresh login', async () => {
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${memberId}`,
      headers: { cookie: adminCookie },
      payload: { disabled: true },
    });

    const stale = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: memberCookie },
    });
    expect(stale.statusCode).toBe(401);

    const attempt = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'grace', password: TEST_PASSWORD },
    });
    expect(attempt.statusCode).toBe(403);
  });

  it('will not let an admin disable their own account', async () => {
    const me = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: adminCookie },
    });
    const myId = me.json<{ user: UserSummaryDto }>().user.id;

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${myId}`,
      headers: { cookie: adminCookie },
      payload: { disabled: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorBody>().error).toBe('cannot_disable_self');
  });

  it('refuses to demote the last remaining admin', async () => {
    const me = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: adminCookie },
    });
    const myId = me.json<{ user: UserSummaryDto }>().user.id;

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${myId}`,
      headers: { cookie: adminCookie },
      payload: { role: 'member' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<ApiErrorBody>().error).toBe('last_admin');
  });

  it('allows the demotion once a second admin exists', async () => {
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${memberId}`,
      headers: { cookie: adminCookie },
      payload: { role: 'admin' },
    });

    const me = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: adminCookie },
    });
    const myId = me.json<{ user: UserSummaryDto }>().user.id;

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/users/${myId}`,
      headers: { cookie: adminCookie },
      payload: { role: 'member' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ user: UserSummaryDto }>().user.role).toBe('member');
  });
});

describe('POST /api/auth/password', () => {
  it('changes your own password and keeps the current session alive', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie: memberCookie },
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'my-new-password' },
    });
    expect(response.statusCode).toBe(200);

    const still = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: memberCookie },
    });
    expect(still.statusCode).toBe(200);

    await expect(login(ctx.app, 'grace', 'my-new-password')).resolves.toBeTruthy();
  });

  it('signs other devices out', async () => {
    const otherDevice = await login(ctx.app, 'grace');

    await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie: memberCookie },
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'my-new-password' },
    });

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: otherDevice },
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a wrong current password', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie: memberCookie },
      payload: { currentPassword: 'not-it', newPassword: 'my-new-password' },
    });

    expect(response.statusCode).toBe(401);
  });
});
