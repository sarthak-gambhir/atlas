import {
  CLOSED_STATUSES,
  daysBetween,
  relevantDue,
  toIsoDate,
  type TaskDto,
  type TaskStatus,
} from '@atlas/shared';

/**
 * Date-only values are calendar dates, not instants. Parsing them at local
 * midnight (rather than letting `new Date('2026-07-28')` land on UTC midnight)
 * keeps a due date on the day the user picked, whatever their offset.
 */
export function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year == null || month == null || day == null) return null;
  return new Date(year, month - 1, day);
}

export function formatIsoDate(date: Date | null): string | null {
  if (!date) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The user's own today, used for the same-day and overdue wording. */
export function todayIso(): string {
  return formatIsoDate(new Date()) ?? toIsoDate(new Date());
}

export function describeDueDate(dueDate: string | null, status?: TaskStatus): string {
  if (!dueDate) return '';

  // Once a task is closed (done/archived), relative wording like "overdue" no
  // longer makes sense, so fall back to just the date.
  if (status && (CLOSED_STATUSES as readonly string[]).includes(status)) return dueDate;

  const days = daysBetween(todayIso(), dueDate);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return '1 day overdue';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days <= 30) return `in ${days} days`;
  return dueDate;
}

type DatedTask = Pick<TaskDto, 'status' | 'dueStartDate' | 'dueEndDate'>;

export interface DueLabel {
  /** The status-relevant date urgency keys off, or null when undated. */
  date: string | null;
  /** Whether that date is a start or a due milestone. */
  kind: 'start' | 'due';
  /** Prefix for display: "Start" or "Due". */
  prefix: 'Start' | 'Due';
  /** Human phrase such as "in 3 days" or "2 days overdue". */
  phrase: string;
  /** True when work should already have begun (start date passed, not started). */
  lateStart: boolean;
}

/**
 * Picks the date that matters for a task right now: its start date before work
 * begins, its due date once started or closed. Returns the wording and a
 * "should have started" flag so lists can nudge stalled work.
 */
export function dueLabel(task: DatedTask): DueLabel {
  const { date, kind } = relevantDue(task.status, task.dueStartDate, task.dueEndDate);
  const closed = (CLOSED_STATUSES as readonly string[]).includes(task.status);
  const lateStart = kind === 'start' && !closed && date != null && daysBetween(todayIso(), date) < 0;
  return {
    date,
    kind,
    prefix: kind === 'start' ? 'Start' : 'Due',
    phrase: describeDueDate(date, task.status),
    lateStart,
  };
}
