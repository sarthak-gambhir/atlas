import type { BackupBundle, ImportResultDto, ProjectDto, TaskDto } from '@atlas/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { restoreBackup } from '../backup.ts';
import {
  createTestContext,
  login,
  resetDatabase,
  seedUser,
  type TestContext,
} from '../test/helpers.ts';

let ctx: TestContext;
let cookie: string;
let memberCookie: string;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.db);
  await seedUser(ctx.db, { username: 'ada', displayName: 'Ada', role: 'admin' });
  await seedUser(ctx.db, { username: 'grace', displayName: 'Grace' });
  cookie = await login(ctx.app, 'ada');
  memberCookie = await login(ctx.app, 'grace');
});

async function seedContent() {
  const project = await ctx.app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { cookie },
    payload: { name: 'Website', description: 'The marketing site' },
  });
  const projectId = project.json<{ project: ProjectDto }>().project.id;

  await ctx.app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie },
    payload: {
      title: 'Ship the landing page',
      projectId,
      impact: 5,
      effort: 2,
      dueDate: '2026-09-01',
      tags: ['infra', 'urgent'],
    },
  });

  await ctx.app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie },
    payload: { title: 'Undated chore', impact: 1, effort: 1 },
  });
}

async function exportBundle(): Promise<BackupBundle> {
  const response = await ctx.app.inject({
    method: 'GET',
    url: '/api/export',
    headers: { cookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json<BackupBundle>();
}

describe('GET /api/export', () => {
  it('names projects, tags and assignees instead of ids', async () => {
    await seedContent();
    const bundle = await exportBundle();

    expect(bundle.version).toBe(1);
    expect(bundle.projects).toEqual([
      { name: 'Website', description: 'The marketing site', archived: false },
    ]);

    const shipped = bundle.tasks.find((task) => task.title === 'Ship the landing page');
    expect(shipped).toMatchObject({
      project: 'Website',
      impact: 5,
      effort: 2,
      dueDate: '2026-09-01',
      status: 'backlog',
    });
    expect(shipped?.tags.toSorted()).toEqual(['infra', 'urgent']);
  });

  it('offers itself as a download and carries the scoring settings', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/export',
      headers: { cookie },
    });

    expect(response.headers['content-disposition']).toContain('attachment; filename="atlas-');
    expect(response.json<BackupBundle>().scoring).toEqual({
      weights: { impact: 1, urgency: 1 },
      thresholds: { now: 6, next: 4, later: 2 },
    });
  });

  it('never includes credentials', async () => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/api/export',
      headers: { cookie },
    });

    expect(response.body).not.toContain('scrypt');
    expect(response.body).not.toContain('passwordHash');
  });
});

async function importBundle(
  bundle: BackupBundle,
  mode: 'merge' | 'replace' = 'merge',
  as: string = cookie,
) {
  return ctx.app.inject({
    method: 'POST',
    url: '/api/import',
    headers: { cookie: as },
    payload: { mode, bundle },
  });
}

describe('POST /api/import', () => {
  it('round-trips a bundle into an empty database', async () => {
    await seedContent();
    const bundle = await exportBundle();

    await resetDatabase(ctx.db);
    await seedUser(ctx.db, { username: 'ada', displayName: 'Ada', role: 'admin' });
    cookie = await login(ctx.app, 'ada');

    const response = await importBundle(bundle);
    expect(response.statusCode).toBe(200);
    expect(response.json<{ result: ImportResultDto }>().result).toMatchObject({
      projectsCreated: 1,
      tasksCreated: 2,
      tagsCreated: 2,
    });

    const restored = await exportBundle();
    expect(restored.tasks.map((task) => task.title).toSorted()).toEqual([
      'Ship the landing page',
      'Undated chore',
    ]);
    expect(restored.projects).toEqual(bundle.projects);
  });

  it('reuses existing projects and tags rather than duplicating them', async () => {
    await seedContent();
    const bundle = await exportBundle();

    const response = await importBundle(bundle);
    expect(response.json<{ result: ImportResultDto }>().result).toMatchObject({
      projectsCreated: 0,
      tagsCreated: 0,
      tasksCreated: 2,
    });

    const after = await exportBundle();
    expect(after.projects).toHaveLength(1);
    expect(after.tasks).toHaveLength(4);
  });

  it('replaces existing content when asked', async () => {
    await seedContent();
    const bundle = await exportBundle();

    await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'Should not survive' },
    });

    await importBundle(bundle, 'replace');

    const after = await exportBundle();
    expect(after.tasks.map((task) => task.title).toSorted()).toEqual([
      'Ship the landing page',
      'Undated chore',
    ]);
  });

  it('unassigns tasks whose assignee does not exist here, and says so', async () => {
    const bundle: BackupBundle = {
      version: 1,
      projects: [],
      tasks: [
        {
          title: 'Assigned to a stranger',
          status: 'backlog',
          assignee: 'someone-else',
          impact: 3,
          effort: 3,
          confidence: 1,
          tags: [],
        },
      ],
    };

    const response = await importBundle(bundle);
    expect(response.json<{ result: ImportResultDto }>().result.unknownAssignees).toEqual([
      'someone-else',
    ]);

    const tasks = await ctx.app.inject({ method: 'GET', url: '/api/tasks', headers: { cookie } });
    expect(tasks.json<{ tasks: TaskDto[] }>().tasks[0]?.assigneeId).toBeNull();
  });

  it('keeps assignees that do exist, matching on username case-insensitively', async () => {
    const bundle: BackupBundle = {
      version: 1,
      projects: [],
      tasks: [
        {
          title: 'For Grace',
          status: 'backlog',
          assignee: 'GRACE',
          impact: 3,
          effort: 3,
          confidence: 1,
          tags: [],
        },
      ],
    };

    const response = await importBundle(bundle);
    expect(response.json<{ result: ImportResultDto }>().result.unknownAssignees).toEqual([]);

    const tasks = await ctx.app.inject({ method: 'GET', url: '/api/tasks', headers: { cookie } });
    expect(tasks.json<{ tasks: TaskDto[] }>().tasks[0]?.assigneeId).not.toBeNull();
  });

  it('rejects a bundle of the wrong version', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/import',
      headers: { cookie },
      payload: { mode: 'merge', bundle: { version: 2, projects: [], tasks: [] } },
    });

    expect(response.statusCode).toBe(400);
  });

  it('is admin-only', async () => {
    const response = await importBundle(
      { version: 1, projects: [], tasks: [] },
      'merge',
      memberCookie,
    );

    expect(response.statusCode).toBe(403);
  });

  it('rolls the whole bundle back when one task is rejected by the database', async () => {
    const admin = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    const importerId = admin.json<{ user: { id: string } }>().user.id;

    // Straight to the restore function: an impact of 9 could never get past the
    // request schema, but the database check constraint still has to catch it.
    const poisoned = {
      version: 1 as const,
      projects: [{ name: 'Fresh project' }],
      tasks: [
        { title: 'Fine', status: 'backlog' as const, impact: 3, effort: 3, confidence: 1, tags: [] },
        { title: 'Bad', status: 'backlog' as const, impact: 9, effort: 3, confidence: 1, tags: [] },
      ],
    } as unknown as BackupBundle;

    await expect(restoreBackup(ctx.db, poisoned, 'merge', importerId)).rejects.toThrow();

    const after = await exportBundle();
    expect(after.tasks).toHaveLength(0);
    expect(after.projects).toHaveLength(0);
  });
});
