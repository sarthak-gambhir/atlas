import type { TaskStatus } from '@atlas/shared';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  next: 'Next',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  archived: 'Archived',
};

/** Columns shown on the board, in the order work tends to flow. */
export const BOARD_STATUSES: TaskStatus[] = ['backlog', 'next', 'in_progress', 'blocked', 'done'];

export const CONFIDENCE_LABELS: Record<string, string> = {
  '0.5': 'Low (50%)',
  '0.8': 'Medium (80%)',
  '1': 'High (100%)',
};
