/** Domain vocabulary shared by the Postgres schema, the API and the client. */

export const TASK_STATUSES = [
  'backlog',
  'next',
  'in_progress',
  'blocked',
  'done',
  'archived',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Statuses that take a task out of the active backlog. */
export const CLOSED_STATUSES: readonly TaskStatus[] = ['done', 'archived'];

export const USER_ROLES = ['admin', 'member'] as const;
export type UserRole = (typeof USER_ROLES)[number];
