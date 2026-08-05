import type { PriorityBucket, TaskStatus } from '@atlas/shared';

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
  '0': 'None (0%)',
  '0.5': 'Low (50%)',
  '0.8': 'Medium (80%)',
  '1': 'High (100%)',
};

/** Options for the urgency override select: Auto (derive from due date) plus 1-5. */
export const URGENCY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Auto' },
  { value: '1', label: '1 - Low' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5 - High' },
];

export const BUCKET_LABELS: Record<PriorityBucket, string> = {
  now: 'Now',
  next: 'Next',
  later: 'Later',
  someday: 'Someday',
};

// The two-color model has no accent palette, so priority is conveyed by weight.
// Only `now` is filled (loudest); the rest are outlined and set apart by their
// border style (see the `.bucket-badge-*` rules in app.css): solid, then
// dashed, then dotted as priority falls.
export const BUCKET_BADGE_VARIANT: Record<PriorityBucket, 'solid' | 'outline'> = {
  now: 'solid',
  next: 'outline',
  later: 'outline',
  someday: 'outline',
};
