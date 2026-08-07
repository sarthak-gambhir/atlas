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

/**
 * A member's role within a single project. The project owner (see
 * `projects.ownerId`) outranks both and is shown as "Owner". `editor` can
 * create and edit that project's tasks; `viewer` has read-only access.
 */
export const PROJECT_MEMBER_ROLES = ['editor', 'viewer'] as const;
export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];

/**
 * Curated icon keys a project can wear. Stored as a plain string; the client
 * maps each key to a Remix icon (see apps/web/src/lib/projectIcons.tsx). A null
 * or unknown value falls back to the default folder icon.
 */
export const PROJECT_ICON_KEYS = [
  'folder',
  'rocket',
  'bug',
  'flask',
  'book',
  'code',
  'palette',
  'briefcase',
  'lightbulb',
  'target',
  'cloud',
  'database',
  'flag',
  'star',
  'calendar',
  'chat',
  'heart',
  'home',
  'bookmark',
  'shield',
  'globe',
  'settings',
  'chart',
  'pie',
  'mail',
  'phone',
  'pin',
  'key',
  'lock',
  'music',
  'camera',
  'pencil',
] as const;
export type ProjectIconKey = (typeof PROJECT_ICON_KEYS)[number];
