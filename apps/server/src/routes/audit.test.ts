import type { AuditLogPageDto, ProjectDto, TaskDto } from '@atlas/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestContext,
  login,
  resetDatabase,
  seedUser,
  type TestContext,
} from '../test/helpers.ts';

let ctx: TestContext;
let adaCookie: string;
let graceCookie: string;
let demoCookie: string;
let adaId: string;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.db);
  const ada = await seedUser(ctx.db, { username: 'ada', displayName: 'Ada', role: 'admin' });
  adaId = ada.id;
  await seedUser(ctx.db, { username: 'grace', displayName: 'Grace' });
  // A seeded demo account (see auth/demo.ts): its activity must never be logged.
  await seedUser(ctx.db, { username: 'john.doe', displayName: 'John Doe' });
  adaCookie = await login(ctx.app, 'ada');
  graceCookie = await login(ctx.app, 'grace');
  demoCookie = await login(ctx.app, 'john.doe');
});

async function createTask(as: string, body: Record<string, unknown> = {}): Promise<TaskDto> {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie: as },
    payload: { title: 'A task', ...body },
  });
  return response.json<{ task: TaskDto }>().task;
}

async function createProject(as: string, name = 'Project'): Promise<string> {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { cookie: as },
    payload: { name },
  });
  return response.json<{ project: ProjectDto }>().project.id;
}

async function auditLogs(query = '', as = adaCookie): Promise<AuditLogPageDto> {
  const response = await ctx.app.inject({
    method: 'GET',
    url: `/api/audit-logs${query}`,
    headers: { cookie: as },
  });
  expect(response.statusCode).toBe(200);
  return response.json<AuditLogPageDto>();
}

describe('audit recording', () => {
  it('records task and project mutations by a normal actor', async () => {
    const projectId = await createProject(adaCookie, 'Website');
    const task = await createTask(adaCookie, { projectId });
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      headers: { cookie: adaCookie },
      payload: { impact: 5 },
    });

    const page = await auditLogs();
    const actions = page.rows.map((row) => row.action);
    expect(actions).toContain('project.create');
    expect(actions).toContain('task.create');
    expect(actions).toContain('task.update');
    expect(page.rows.every((row) => row.actorUsername === 'ada')).toBe(true);
    // Newest first.
    expect(page.rows[0]!.action).toBe('task.update');
  });

  it('excludes actions performed by a demo account', async () => {
    await createTask(demoCookie);

    const page = await auditLogs();
    expect(page.total).toBe(0);
    expect(page.rows).toEqual([]);
  });

  it('excludes actions scoped to a demo-owned project', async () => {
    // John (a demo user) owns the project; even a non-demo admin acting in it
    // stays out of the trail.
    const demoProject = await createProject(demoCookie, 'Demo space');
    await createTask(adaCookie, { projectId: demoProject });

    const page = await auditLogs();
    expect(page.total).toBe(0);
  });
});

describe('GET /api/audit-logs', () => {
  it('is admin-only', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/audit-logs',
      headers: { cookie: graceCookie },
    });
    expect(response.statusCode).toBe(403);
  });

  it('filters by action and actor and paginates', async () => {
    await createTask(adaCookie, { title: 'One' });
    await createTask(adaCookie, { title: 'Two' });
    await createTask(adaCookie, { title: 'Three' });

    const byAction = await auditLogs('?action=task.create');
    expect(byAction.total).toBe(3);
    expect(byAction.rows.every((row) => row.action === 'task.create')).toBe(true);

    const byActor = await auditLogs(`?actorUserId=${adaId}`);
    expect(byActor.total).toBe(3);

    const firstPage = await auditLogs('?limit=2&offset=0');
    expect(firstPage.rows).toHaveLength(2);
    expect(firstPage.total).toBe(3);

    const secondPage = await auditLogs('?limit=2&offset=2');
    expect(secondPage.rows).toHaveLength(1);
  });

  it('rejects an unknown action filter', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/audit-logs?action=not.a.real.action',
      headers: { cookie: adaCookie },
    });
    expect(response.statusCode).toBe(400);
  });
});
