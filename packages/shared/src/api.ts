import { z } from 'zod';

import { TASK_STATUSES, USER_ROLES } from './domain.ts';
import type { PRIORITY_BUCKETS } from './score.ts';
import { CONFIDENCE_VALUES } from './score.ts';

export const loginInputSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(1024),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const sessionUserSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(USER_ROLES),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** Every non-2xx response from the API has this shape. */
export interface ApiErrorBody {
  error: string;
  message: string;
  issues?: { path: string; message: string }[];
}

export const scoringSettingsSchema = z.object({
  weights: z.object({
    impact: z.number().min(0).max(10),
    urgency: z.number().min(0).max(10),
  }),
  thresholds: z.object({
    now: z.number().min(0).max(50),
    next: z.number().min(0).max(50),
    later: z.number().min(0).max(50),
  }),
});

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const confidenceSchema = z
  .number()
  .refine((value): value is (typeof CONFIDENCE_VALUES)[number] =>
    (CONFIDENCE_VALUES as readonly number[]).includes(value),
  );

/** Date-only, no timezone, matching the `date` column. */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

const levelSchema = z.number().int().min(1).max(5);
const tagNameSchema = z.string().trim().min(1).max(50);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(10_000).nullish(),
  status: taskStatusSchema.optional(),
  projectId: z.uuid().nullish(),
  assigneeId: z.uuid().nullish(),
  impact: levelSchema.optional(),
  effort: levelSchema.optional(),
  confidence: confidenceSchema.optional(),
  urgencyOverride: levelSchema.nullish(),
  dueDate: isoDateSchema.nullish(),
  estimateHours: z.number().min(0).max(10_000).nullish(),
  tags: z.array(tagNameSchema).max(20).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial().extend({
  manualRank: z.number().nullish(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** How many tasks one bulk request may touch. */
export const BULK_UPDATE_LIMIT = 200;

export const bulkUpdateSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(BULK_UPDATE_LIMIT),
  /**
   * Deliberately narrow. Status, project and assignee mean the same thing
   * applied to a hundred tasks as to one; impact, effort, confidence and due
   * dates are per-task judgements and stay out of bulk edits.
   */
  patch: createTaskSchema
    .pick({ status: true, projectId: true, assigneeId: true })
    .refine((patch) => Object.keys(patch).length > 0, {
      message: 'Choose at least one field to change.',
    }),
});
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;

export const taskFilterSchema = z.object({
  status: taskStatusSchema.optional(),
  projectId: z.uuid().optional(),
  assigneeId: z.uuid().optional(),
  tag: tagNameSchema.optional(),
  q: z.string().trim().max(200).optional(),
  dueBefore: isoDateSchema.optional(),
  /** Done and archived work is hidden unless asked for. */
  includeClosed: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((value) => value === true || value === 'true')
    .optional(),
});
export type TaskFilter = z.infer<typeof taskFilterSchema>;

export const reorderSchema = z.object({
  /** Task ids in their new pinned order. Everything else stays score-ranked. */
  orderedIds: z.array(z.uuid()).max(500),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2_000).nullish(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial().extend({
  archived: z.boolean().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
  /** Tasks that are neither done nor archived. */
  openTaskCount: number;
  createdAt: string;
}

export interface TagDto {
  id: string;
  name: string;
  taskCount: number;
}

export interface UserSummaryDto {
  id: string;
  username: string;
  displayName: string;
  role: (typeof USER_ROLES)[number];
  disabled: boolean;
  createdAt: string;
}

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[A-Za-z0-9._-]+$/, 'Letters, numbers, dot, dash and underscore only');

export const createUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(1024),
  role: z.enum(USER_ROLES).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  username: usernameSchema.optional(),
  displayName: z.string().trim().min(1).max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
  disabled: z.boolean().optional(),
  /** Set by an admin; revokes the user's existing sessions. */
  password: z.string().min(8).max(1024).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(8).max(1024),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  username: usernameSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const usernameAvailabilityQuerySchema = z.object({
  username: usernameSchema,
  /** Id of the account being edited, whose own current name counts as free. */
  excludeUserId: z.uuid().optional(),
});

/**
 * A portable snapshot. Projects, tags and people are referenced by name rather
 * than id so a bundle can be restored into a different database.
 */
export const exportedTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(10_000).nullish(),
  status: taskStatusSchema,
  project: z.string().nullish(),
  assignee: z.string().nullish(),
  impact: levelSchema,
  effort: levelSchema,
  confidence: confidenceSchema,
  urgencyOverride: levelSchema.nullish(),
  dueDate: isoDateSchema.nullish(),
  estimateHours: z.number().min(0).max(10_000).nullish(),
  manualRank: z.number().nullish(),
  tags: z.array(tagNameSchema).max(20),
  createdAt: z.string().optional(),
  completedAt: z.string().nullish(),
});
export type ExportedTask = z.infer<typeof exportedTaskSchema>;

export const exportedProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2_000).nullish(),
  archived: z.boolean().optional(),
});

export const backupBundleSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().optional(),
  scoring: scoringSettingsSchema.optional(),
  projects: z.array(exportedProjectSchema).max(1_000),
  tasks: z.array(exportedTaskSchema).max(10_000),
});
export type BackupBundle = z.infer<typeof backupBundleSchema>;

export const importRequestSchema = z.object({
  /** `replace` clears existing tasks and projects first; `merge` adds to them. */
  mode: z.enum(['merge', 'replace']).default('merge'),
  bundle: backupBundleSchema,
  /**
   * Remaps assignees that do not exist here. Keys are bundle usernames
   * (lower-cased), values are the id of an existing user to assign instead.
   * Anything omitted falls back to unassigned.
   */
  assigneeMap: z.record(z.string(), z.uuid()).optional(),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

export interface ImportResultDto {
  projectsCreated: number;
  tasksCreated: number;
  tagsCreated: number;
  /** Assignee usernames in the bundle that do not exist here. */
  unknownAssignees: string[];
}

export interface TaskDto {
  id: string;
  title: string;
  notes: string | null;
  status: (typeof TASK_STATUSES)[number];
  projectId: string | null;
  assigneeId: string | null;
  impact: number;
  effort: number;
  confidence: number;
  urgencyOverride: number | null;
  dueDate: string | null;
  estimateHours: number | null;
  manualRank: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Computed per request, never stored. */
  score: number;
  bucket: (typeof PRIORITY_BUCKETS)[number];
}
