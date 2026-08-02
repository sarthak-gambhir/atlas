import { TASK_STATUSES, USER_ROLES } from '@atlas/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const taskStatusEnum = pgEnum('task_status', TASK_STATUSES);
export const userRoleEnum = pgEnum('user_role', USER_ROLES);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    /** scrypt$N$r$p$salt$hash - see auth/password.ts */
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('member'),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`)],
);

export const sessions = pgTable(
  'sessions',
  {
    /** sha256 of the cookie token; the raw token is never stored. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_expires_idx').on(t.expiresAt)],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    /** The project's owner; owner-or-admin may edit/archive it. Nulled if the owner is deleted. */
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    /** A curated icon key (see PROJECT_ICON_KEYS); null falls back to a folder. */
    icon: text('icon'),
    /** Defaults seeded into a new task created in this project. All optional. */
    defaultAssigneeId: uuid('default_assignee_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    defaultImpact: smallint('default_impact'),
    defaultEffort: smallint('default_effort'),
    defaultConfidence: real('default_confidence'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('projects_name_lower_idx').on(sql`lower(${t.name})`),
    check('projects_default_impact_range', sql`${t.defaultImpact} is null or ${t.defaultImpact} between 1 and 5`),
    check('projects_default_effort_range', sql`${t.defaultEffort} is null or ${t.defaultEffort} between 1 and 5`),
    check(
      'projects_default_confidence_values',
      sql`${t.defaultConfidence} is null or ${t.defaultConfidence} in (0, 0.5, 0.8, 1.0)`,
    ),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey(),
    title: text('title').notNull(),
    notes: text('notes'),
    status: taskStatusEnum('status').notNull().default('backlog'),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    impact: smallint('impact').notNull().default(3),
    effort: smallint('effort').notNull().default(3),
    confidence: real('confidence').notNull().default(1),
    urgencyOverride: smallint('urgency_override'),
    dueDate: date('due_date'),
    estimateHours: real('estimate_hours'),
    /** Sparse float so a reorder is a single UPDATE. Null means unpinned. */
    manualRank: doublePrecision('manual_rank'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('tasks_status_idx').on(t.status),
    index('tasks_project_idx').on(t.projectId),
    index('tasks_assignee_idx').on(t.assigneeId),
    index('tasks_due_idx').on(t.dueDate),
    check('tasks_impact_range', sql`${t.impact} between 1 and 5`),
    check('tasks_effort_range', sql`${t.effort} between 1 and 5`),
    check('tasks_confidence_values', sql`${t.confidence} in (0, 0.5, 0.8, 1.0)`),
    check(
      'tasks_urgency_override_range',
      sql`${t.urgencyOverride} is null or ${t.urgencyOverride} between 1 and 5`,
    ),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
  },
  (t) => [uniqueIndex('tags_name_lower_idx').on(sql`lower(${t.name})`)],
);

export const taskTags = pgTable(
  'task_tags',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.tagId] })],
);

/**
 * Who may see and work in a project. Admins bypass this (they see everything);
 * members see only the projects they belong to. The owner is always a member.
 */
export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Per-project role: `editor` can edit tasks, `viewer` is read-only. */
    role: text('role').notNull().default('editor'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    check('project_members_role_values', sql`${t.role} in ('editor', 'viewer')`),
  ],
);

/** Tags seeded into a new task created in a project (mirrors task_tags). */
export const projectDefaultTags = pgTable(
  'project_default_tags',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.tagId] })],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

/**
 * Login throttling lives in the database because serverless instances do not
 * share memory, so an in-process counter would be trivially bypassed.
 */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: uuid('id').primaryKey(),
    username: text('username').notNull(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
    succeeded: boolean('succeeded').notNull(),
  },
  (t) => [index('login_attempts_idx').on(sql`lower(${t.username})`, t.attemptedAt.desc())],
);
