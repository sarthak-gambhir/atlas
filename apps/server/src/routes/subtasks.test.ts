import type { ProjectDto, SubtaskDto, TaskDto } from '@atlas/shared';
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

async function createTask(body: Record<string, unknown> = {}): Promise<TaskDto> {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie },
    payload: { title: 'Parent task', ...body },
  });
  if (response.statusCode !== 201) {
    throw new Error(`Create task failed with ${response.statusCode}: ${response.body}`);
  }
  return response.json<{ task: TaskDto }>().task;
}

async function createProject(name = 'Website'): Promise<string> {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/projects',
    headers: { cookie },
    payload: { name },
  });
  return response.json<{ project: ProjectDto }>().project.id;
}

async function addSubtask(taskId: string, description: string, as = cookie) {
  return ctx.app.inject({
    method: 'POST',
    url: `/api/tasks/${taskId}/subtasks`,
    headers: { cookie: as },
    payload: { description },
  });
}

async function getTask(id: string): Promise<TaskDto> {
  const response = await ctx.app.inject({ method: 'GET', url: `/api/tasks/${id}`, headers: { cookie } });
  expect(response.statusCode).toBe(200);
  return response.json<{ task: TaskDto }>().task;
}

describe('POST /api/tasks/:id/subtasks', () => {
  it('appends subtasks in order and surfaces them on the task', async () => {
    const task = await createTask();

    const first = await addSubtask(task.id, 'First step');
    expect(first.statusCode).toBe(201);
    const second = await addSubtask(task.id, 'Second step');
    expect(second.statusCode).toBe(201);

    const refreshed = await getTask(task.id);
    expect(refreshed.subtasks.map((subtask) => subtask.description)).toEqual([
      'First step',
      'Second step',
    ]);
    expect(refreshed.subtasks[0]!.position).toBeLessThan(refreshed.subtasks[1]!.position);
    expect(refreshed.subtasks.every((subtask) => subtask.done === false)).toBe(true);
  });

  it('requires a description', async () => {
    const task = await createTask();
    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/subtasks`,
      headers: { cookie },
      payload: { description: '' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses a member who cannot see the task', async () => {
    const projectId = await createProject();
    const task = await createTask({ projectId });

    // Grace is not a member of Ada's project.
    const response = await addSubtask(task.id, 'Sneaky', memberCookie);
    expect(response.statusCode).toBe(404);
  });

  it('refuses editing an archived task', async () => {
    const task = await createTask();
    await ctx.app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      headers: { cookie },
      payload: { status: 'archived' },
    });

    const response = await addSubtask(task.id, 'Too late');
    expect(response.statusCode).toBe(409);
    expect(response.json<{ error: string }>().error).toBe('task_archived');
  });
});

describe('PATCH /api/subtasks/:id', () => {
  it('toggles done and edits the description', async () => {
    const task = await createTask();
    const created = (await addSubtask(task.id, 'Do the thing')).json<{ subtask: SubtaskDto }>()
      .subtask;

    const toggled = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/subtasks/${created.id}`,
      headers: { cookie },
      payload: { done: true, description: 'Do the thing well' },
    });
    expect(toggled.statusCode).toBe(200);

    const refreshed = await getTask(task.id);
    expect(refreshed.subtasks[0]).toMatchObject({ done: true, description: 'Do the thing well' });
  });

  it('404s for an unknown subtask', async () => {
    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/subtasks/${crypto.randomUUID()}`,
      headers: { cookie },
      payload: { done: true },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe('DELETE /api/subtasks/:id', () => {
  it('removes the subtask', async () => {
    const task = await createTask();
    const created = (await addSubtask(task.id, 'Temporary')).json<{ subtask: SubtaskDto }>().subtask;

    const response = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/subtasks/${created.id}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(204);

    const refreshed = await getTask(task.id);
    expect(refreshed.subtasks).toHaveLength(0);
  });
});
