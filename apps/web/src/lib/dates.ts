import { daysBetween, toIsoDate } from '@atlas/shared';

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

export function describeDueDate(dueDate: string | null): string {
  if (!dueDate) return '';

  const days = daysBetween(todayIso(), dueDate);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return '1 day overdue';
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days <= 30) return `in ${days} days`;
  return dueDate;
}
