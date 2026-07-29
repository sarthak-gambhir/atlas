import type {
  ApiErrorBody,
  ProjectDto,
  TagDto,
  TaskDto,
  UserSummaryDto,
} from '@atlas/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

async function createProject(name: string): Promise<ProjectDto> {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { cookie },
    payload: { name },
  });

  if (response.statusCode !== 201) {
    throw new Error(`Create failed with ${response.statusCode}: ${response.body}`);
  }
  return response.json<{ project: ProjectDto }>().project;
}

async function listProjects(query = ''): Promise<ProjectDto[]> {
  const response = await ctx.app.inject({
    method: 'GET',
    url: `/api/projects${query}`,
    headers: { cookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json<{ projects: ProjectDto[] }>().projects;
}

describe('projects', () => {
  it('requires a session', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/projects' });
    expect(response.statusCode).toBe(401);
  });

  it('creates and lists projects alphabetically', async () => {
    await createProject('Website');
    await createProject('Api');

    expect((await listProjects()).map((project) => project.name)).toEqual(['Api', 'Website']);
  });

  it('rejects a duplicate name regardless of casing', async () => {
    await createProject('Website');

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie },
      payload: { name: 'website' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<ApiErrorBody>().error).toBe('already_exists');
  });

  it('counts only open tasks', async () => {
    const project = await createProject('Website');

    const open = await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'open work', projectId: project.id },
    });
    const closing = await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'finished work', projectId: project.id },
    });
    expect(open.statusCode).toBe(201);

    const doneId = closing.json<{ task: TaskDto }>().task.id;
    await ctx.app.inject({
      method: 'POST',
      url: `/api/tasks/${doneId}/complete`,
      headers: { cookie },
    });

    const [listed] = await listProjects();
    expect(listed?.openTaskCount).toBe(1);
  });

  it('hides archived projects unless asked', async () => {
    const project = await createProject('Retired');

    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/projects/${project.id}`,
      headers: { cookie },
      payload: { archived: true },
    });

    expect(await listProjects()).toHaveLength(0);
    expect(await listProjects('?includeArchived=true')).toHaveLength(1);
  });

  it('keeps tasks when a project is deleted, unlinking them instead', async () => {
    const project = await createProject('Doomed');
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'survivor', projectId: project.id },
    });
    const taskId = created.json<{ task: TaskDto }>().task.id;

    const deleted = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/projects/${project.id}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(204);

    const task = await ctx.app.inject({
      method: 'GET',
      url: `/api/tasks/${taskId}`,
      headers: { cookie },
    });
    expect(task.statusCode).toBe(200);
    expect(task.json<{ task: TaskDto }>().task.projectId).toBeNull();
  });

  it('only lets an admin delete a project', async () => {
    const project = await createProject('Protected');

    const response = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/projects/${project.id}`,
      headers: { cookie: memberCookie },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('task filtering by project and assignee', () => {
  it('narrows the backlog to one project', async () => {
    const website = await createProject('Website');
    await createProject('Api');

    await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'in website', projectId: website.id },
    });
    await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'unassigned to a project' },
    });

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/tasks?projectId=${website.id}`,
      headers: { cookie },
    });

    expect(response.json<{ tasks: TaskDto[] }>().tasks.map((task) => task.title)).toEqual([
      'in website',
    ]);
  });

  it('narrows the backlog to one assignee', async () => {
    const users = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: { cookie } });
    const grace = users
      .json<{ users: UserSummaryDto[] }>()
      .users.find((user) => user.username === 'grace');
    expect(grace).toBeDefined();

    await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'for grace', assigneeId: grace?.id },
    });
    await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'for nobody' },
    });

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/api/tasks?assigneeId=${grace?.id ?? ''}`,
      headers: { cookie },
    });

    expect(response.json<{ tasks: TaskDto[] }>().tasks.map((task) => task.title)).toEqual([
      'for grace',
    ]);
  });
});

describe('GET /api/tags', () => {
  it('lists tags with how many tasks use each', async () => {
    await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'first', tags: ['infra', 'docs'] },
    });
    await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'second', tags: ['infra'] },
    });

    const response = await ctx.app.inject({ method: 'GET', url: '/api/tags', headers: { cookie } });

    const listed = response.json<{ tags: TagDto[] }>().tags;
    expect(listed.map(({ name, taskCount }) => ({ name, taskCount }))).toEqual([
      { name: 'docs', taskCount: 1 },
      { name: 'infra', taskCount: 2 },
    ]);
    expect(listed.every((tag) => tag.id.length > 0)).toBe(true);
  });
});

describe('GET /api/users', () => {
  it('lists people without leaking password hashes', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/users', headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain('scrypt');
    expect(
      response
        .json<{ users: UserSummaryDto[] }>()
        .users.map((user) => user.username)
        .toSorted(),
    ).toEqual(['ada', 'grace']);
  });
});
