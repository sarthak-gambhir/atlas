import type { ApiErrorBody, TaskDto } from '@atlas/shared';
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

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.db);
  await seedUser(ctx.db, { username: 'ada', displayName: 'Ada' });
  cookie = await login(ctx.app, 'ada');
});

async function createTask(body: Record<string, unknown>): Promise<TaskDto> {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/tasks',
    headers: { cookie },
    payload: body,
  });

  if (response.statusCode !== 201) {
    throw new Error(`Create failed with ${response.statusCode}: ${response.body}`);
  }
  return response.json<{ task: TaskDto }>().task;
}

async function listTasks(query = ''): Promise<TaskDto[]> {
  const response = await ctx.app.inject({
    method: 'GET',
    url: `/api/tasks${query}`,
    headers: { cookie },
  });
  expect(response.statusCode).toBe(200);
  return response.json<{ tasks: TaskDto[] }>().tasks;
}

describe('task authorization', () => {
  it('refuses anonymous access', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/api/tasks' });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /api/tasks', () => {
  it('applies defaults and returns a computed score', async () => {
    const task = await createTask({ title: 'Write the README' });

    expect(task).toMatchObject({
      title: 'Write the README',
      status: 'backlog',
      impact: 3,
      effort: 3,
      confidence: 1,
      tags: [],
      manualRank: null,
      completedAt: null,
    });
    // (3 impact + 1 urgency) / 3 effort
    expect(task.score).toBeCloseTo(1.3, 5);
    expect(task.bucket).toBe('someday');
  });

  it('scores an urgent, cheap, high-impact task at the top of the range', async () => {
    const task = await createTask({
      title: 'Ship the fix',
      impact: 5,
      effort: 1,
      dueStartDate: new Date().toISOString().slice(0, 10),
    });

    expect(task.score).toBe(10);
    expect(task.bucket).toBe('now');
  });

  it('creates tags on the fly and dedupes them case-insensitively', async () => {
    const task = await createTask({ title: 'Tagged', tags: ['Infra', 'infra', ' urgent '] });
    expect(task.tags.toSorted()).toEqual(['Infra', 'urgent']);
  });

  it('rejects an empty title', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: '   ' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorBody>().error).toBe('validation_error');
  });

  it('rejects an out-of-range impact', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'Too important', impact: 9 },
    });

    expect(response.statusCode).toBe(400);
  });

  it('reports an unknown assignee as a client error, not a crash', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie },
      payload: { title: 'Orphan', assigneeId: crypto.randomUUID() },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorBody>().error).toBe('invalid_reference');
  });
});

describe('GET /api/tasks', () => {
  it('ranks higher-scoring tasks first', async () => {
    await createTask({ title: 'low', impact: 1, effort: 5 });
    await createTask({ title: 'high', impact: 5, effort: 1 });
    await createTask({ title: 'middle', impact: 3, effort: 3 });

    expect((await listTasks()).map((task) => task.title)).toEqual(['high', 'middle', 'low']);
  });

  it('hides done and archived work unless asked', async () => {
    const done = await createTask({ title: 'finished' });
    await createTask({ title: 'open' });

    await ctx.app.inject({
      method: 'POST',
      url: `/api/tasks/${done.id}/complete`,
      headers: { cookie },
    });

    expect((await listTasks()).map((t) => t.title)).toEqual(['open']);
    expect((await listTasks('?includeClosed=true')).map((t) => t.title).toSorted()).toEqual([
      'finished',
      'open',
    ]);
  });

  it('filters by status, tag and free text', async () => {
    await createTask({ title: 'infra upgrade', tags: ['infra'] });
    await createTask({ title: 'write docs', tags: ['docs'], status: 'in_progress' });

    expect((await listTasks('?tag=infra')).map((t) => t.title)).toEqual(['infra upgrade']);
    expect((await listTasks('?status=in_progress')).map((t) => t.title)).toEqual(['write docs']);
    expect((await listTasks('?q=docs')).map((t) => t.title)).toEqual(['write docs']);
  });

  it('searches notes as well as titles', async () => {
    await createTask({ title: 'Opaque title', notes: 'mentions kubernetes' });
    expect((await listTasks('?q=kubernetes')).map((t) => t.title)).toEqual(['Opaque title']);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('updates fields and rescores', async () => {
    const task = await createTask({ title: 'Rework', impact: 1, effort: 5 });

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      headers: { cookie },
      payload: { impact: 5, effort: 1 },
    });

    expect(response.statusCode).toBe(200);
    const updated = response.json<{ task: TaskDto }>().task;
    expect(updated.score).toBeGreaterThan(task.score);
  });

  it('replaces the tag set rather than appending', async () => {
    const task = await createTask({ title: 'Tagged', tags: ['one', 'two'] });

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      headers: { cookie },
      payload: { tags: ['three'] },
    });

    expect(response.json<{ task: TaskDto }>().task.tags).toEqual(['three']);
  });

  it('clears a due date when set to null', async () => {
    const task = await createTask({ title: 'Dated', dueEndDate: '2026-12-31' });

    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      headers: { cookie },
      payload: { dueEndDate: null },
    });

    expect(response.json<{ task: TaskDto }>().task.dueEndDate).toBeNull();
  });

  it('404s for an unknown id', async () => {
    const response = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/tasks/${crypto.randomUUID()}`,
      headers: { cookie },
      payload: { title: 'ghost' },
    });

    expect(response.statusCode).toBe(404);
  });
});

describe('completion and deletion', () => {
  it('stamps completedAt when completing and clears it when reopening', async () => {
    const task = await createTask({ title: 'Finish me' });

    const completed = await ctx.app.inject({
      method: 'POST',
      url: `/api/tasks/${task.id}/complete`,
      headers: { cookie },
    });
    const done = completed.json<{ task: TaskDto }>().task;
    expect(done.status).toBe('done');
    expect(done.completedAt).not.toBeNull();

    const reopened = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/tasks/${task.id}`,
      headers: { cookie },
      payload: { status: 'backlog' },
    });
    expect(reopened.json<{ task: TaskDto }>().task.completedAt).toBeNull();
  });

  it('deletes once and then reports gone', async () => {
    const task = await createTask({ title: 'Temporary' });

    const first = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/tasks/${task.id}`,
      headers: { cookie },
    });
    expect(first.statusCode).toBe(204);

    const second = await ctx.app.inject({
      method: 'DELETE',
      url: `/api/tasks/${task.id}`,
      headers: { cookie },
    });
    expect(second.statusCode).toBe(404);
  });
});

describe('POST /api/tasks/bulk', () => {
  interface BulkResult {
    updated: number;
    ids: string[];
  }

  function bulk(payload: Record<string, unknown>) {
    return ctx.app.inject({
      method: 'POST',
      url: '/api/tasks/bulk',
      headers: { cookie },
      payload,
    });
  }

  it('moves a selection to a new status and stamps completion once', async () => {
    const first = await createTask({ title: 'One' });
    const second = await createTask({ title: 'Two' });
    const untouched = await createTask({ title: 'Three' });

    const response = await bulk({ ids: [first.id, second.id], patch: { status: 'done' } });

    expect(response.statusCode).toBe(200);
    expect(response.json<BulkResult>().updated).toBe(2);

    const closed = await listTasks('?includeClosed=true');
    const byId = new Map(closed.map((task) => [task.id, task]));

    expect(byId.get(first.id)?.status).toBe('done');
    expect(byId.get(first.id)?.completedAt).not.toBeNull();
    expect(byId.get(second.id)?.status).toBe('done');
    expect(byId.get(untouched.id)?.status).toBe('backlog');
    expect(byId.get(untouched.id)?.completedAt).toBeNull();
  });

  it('clears completion when a selection is reopened', async () => {
    const task = await createTask({ title: 'Reopen me', status: 'done' });

    await bulk({ ids: [task.id], patch: { status: 'next' } });

    const [reopened] = await listTasks();
    expect(reopened).toMatchObject({ status: 'next', completedAt: null });
  });

  it('assigns a project and an owner in one request', async () => {
    const project = await ctx.app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie },
      payload: { name: 'Bulk project' },
    });
    const projectId = project.json<{ project: { id: string } }>().project.id;

    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    const myId = me.json<{ user: { id: string } }>().user.id;

    const task = await createTask({ title: 'Needs an owner' });
    await bulk({ ids: [task.id], patch: { projectId, assigneeId: myId } });

    const [updated] = await listTasks();
    expect(updated).toMatchObject({ projectId, assigneeId: myId });
  });

  it('unassigns when given an explicit null', async () => {
    const project = await ctx.app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie },
      payload: { name: 'Temporary home' },
    });
    const projectId = project.json<{ project: { id: string } }>().project.id;
    const task = await createTask({ title: 'Leaving the project', projectId });

    await bulk({ ids: [task.id], patch: { projectId: null } });

    const [updated] = await listTasks();
    expect(updated?.projectId).toBeNull();
  });

  it('leaves fields the patch does not mention alone', async () => {
    const task = await createTask({ title: 'Careful', impact: 5, effort: 1, tags: ['keep'] });

    await bulk({ ids: [task.id], patch: { status: 'in_progress' } });

    const [updated] = await listTasks();
    expect(updated).toMatchObject({ impact: 5, effort: 1, tags: ['keep'], score: task.score });
  });

  it('reports only the ids that existed', async () => {
    const task = await createTask({ title: 'Real' });
    const ghost = '11111111-1111-4111-8111-111111111111';

    const response = await bulk({ ids: [task.id, ghost], patch: { status: 'blocked' } });

    expect(response.json<BulkResult>()).toEqual({ updated: 1, ids: [task.id] });
  });

  it('rejects an empty patch', async () => {
    const task = await createTask({ title: 'Nothing to do' });

    const response = await bulk({ ids: [task.id], patch: {} });

    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorBody>().error).toBe('validation_error');
  });

  it('rejects an empty selection', async () => {
    expect((await bulk({ ids: [], patch: { status: 'done' } })).statusCode).toBe(400);
  });

  it('refuses a field that is not bulk editable', async () => {
    const task = await createTask({ title: 'Judgement call' });

    // `impact` is stripped rather than applied, leaving nothing to change.
    const response = await bulk({ ids: [task.id], patch: { impact: 5 } });

    expect(response.statusCode).toBe(400);
  });

  it('refuses a project that does not exist', async () => {
    const task = await createTask({ title: 'Homeless' });

    const response = await bulk({
      ids: [task.id],
      patch: { projectId: '22222222-2222-4222-8222-222222222222' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorBody>().error).toBe('invalid_reference');
  });

  it('refuses anonymous access', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks/bulk',
      payload: { ids: ['11111111-1111-4111-8111-111111111111'], patch: { status: 'done' } },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /api/tasks/reorder', () => {
  it('pins the given order above everything score-ranked', async () => {
    const weak = await createTask({ title: 'weak', impact: 1, effort: 5 });
    await createTask({ title: 'strong', impact: 5, effort: 1 });

    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/tasks/reorder',
      headers: { cookie },
      payload: { orderedIds: [weak.id] },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ tasks: TaskDto[] }>().tasks.map((t) => t.title)).toEqual([
      'weak',
      'strong',
    ]);
  });
});
