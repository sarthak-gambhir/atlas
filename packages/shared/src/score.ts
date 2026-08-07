/**
 * The prioritization model. Scores are never stored: the API computes them when
 * listing tasks and the client recomputes them live while editing, so a score
 * can never drift out of date as a due date approaches.
 */

import { CLOSED_STATUSES, type TaskStatus } from './domain.ts';

/** Allowed confidence multipliers: none, low, medium, high. */
export const CONFIDENCE_VALUES = [0, 0.5, 0.8, 1] as const;
export type Confidence = (typeof CONFIDENCE_VALUES)[number];

/** Narrows an arbitrary number (from a form or the database) to a valid multiplier. */
export function toConfidence(value: number): Confidence {
  return (CONFIDENCE_VALUES as readonly number[]).includes(value) ? (value as Confidence) : 1;
}

export type UrgencyLevel = 1 | 2 | 3 | 4 | 5;

export interface ScoreWeights {
  impact: number;
  urgency: number;
}

export interface BucketThresholds {
  now: number;
  next: number;
  later: number;
}

export const PRIORITY_BUCKETS = ['now', 'next', 'later', 'someday'] as const;
export type PriorityBucket = (typeof PRIORITY_BUCKETS)[number];

export interface ScoringSettings {
  weights: ScoreWeights;
  thresholds: BucketThresholds;
}

export const DEFAULT_SCORING: ScoringSettings = {
  weights: { impact: 1, urgency: 1 },
  thresholds: { now: 6, next: 4, later: 2 },
};

export interface ScoreInputs {
  /** Value of getting this done, 1-5. */
  impact: number;
  /** Cost of getting it done, 1-5. Divides the score. */
  effort: number;
  /** Multiplier for how sure we are, one of CONFIDENCE_VALUES. */
  confidence: number;
  /** Where the task sits in its lifecycle; picks the date urgency keys off. */
  status: TaskStatus;
  /** When work should begin. Date-only ISO string, or null. */
  dueStartDate: string | null;
  /** When work must finish. Date-only ISO string, or null. */
  dueEndDate: string | null;
  /** Pins urgency to an explicit level, bypassing the dates. */
  urgencyOverride: number | null;
  /** When the task was completed; freezes closed-task urgency. Date-only or full ISO (date portion used). */
  completedAt: string | null;
}

/** Which date drives urgency and display for a task, and which milestone it is. */
export function relevantDue(
  status: TaskStatus,
  dueStartDate: string | null,
  dueEndDate: string | null,
): { date: string | null; kind: 'start' | 'due' } {
  // Once work has started, the start date is behind us: only the deadline matters.
  const started = status === 'in_progress' || status === 'blocked';
  const closed = (CLOSED_STATUSES as readonly string[]).includes(status);
  if (started || closed) {
    return { date: dueEndDate ?? dueStartDate, kind: 'due' };
  }
  // Not yet started (backlog/next): the start date is the thing to watch, but a
  // bare deadline still counts.
  return dueStartDate != null
    ? { date: dueStartDate, kind: 'start' }
    : { date: dueEndDate, kind: 'due' };
}

const MS_PER_DAY = 86_400_000;

/** Date-only ISO string for a moment in time, in UTC. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Whole days from `from` to `to`, both date-only ISO strings. Negative when
 * `to` is in the past. Parsed as UTC midnight so DST can never shift the count.
 */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new RangeError(`Invalid date range: ${from} -> ${to}`);
  }
  return Math.round((end - start) / MS_PER_DAY);
}

/**
 * Urgency rises as the relevant date approaches. An override wins outright.
 * Undated work sits at the floor so it never crowds out dated work of equal
 * impact.
 */
export function urgencyFor(
  relevantDate: string | null,
  urgencyOverride: number | null,
  today: string,
): UrgencyLevel {
  if (urgencyOverride != null) {
    return clampLevel(urgencyOverride);
  }
  if (relevantDate == null) return 1;

  const days = daysBetween(today, relevantDate);
  if (days <= 0) return 5; // overdue or due today
  if (days <= 3) return 4;
  if (days <= 7) return 3;
  if (days <= 30) return 2;
  return 1;
}

function clampLevel(value: number): UrgencyLevel {
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded as UrgencyLevel;
}

/**
 * Weighted value over cost. Effort divides rather than subtracts so that two
 * tasks of equal value rank by how cheap they are.
 */
export function computeScore(
  task: ScoreInputs,
  settings: ScoringSettings = DEFAULT_SCORING,
  today: string = toIsoDate(new Date()),
): number {
  const closed = (CLOSED_STATUSES as readonly string[]).includes(task.status);
  // A closed task freezes its urgency at completion so a passing deadline can no
  // longer inflate it; an archived task that was never completed drops to the
  // floor. Open tasks measure against today. DTOs may pass a full ISO timestamp.
  const completedDay = task.completedAt?.slice(0, 10) ?? null;
  const reference = closed ? completedDay : today;
  const relevantDate =
    closed && completedDay == null
      ? null
      : relevantDue(task.status, task.dueStartDate, task.dueEndDate).date;
  const urgency = urgencyFor(relevantDate, task.urgencyOverride, reference ?? today);
  const { impact, urgency: urgencyWeight } = settings.weights;
  const effort = task.effort > 0 ? task.effort : 1;
  const raw = ((task.impact * impact + urgency * urgencyWeight) * task.confidence) / effort;
  return Math.round(raw * 10) / 10;
}

export function bucketFor(
  score: number,
  thresholds: BucketThresholds = DEFAULT_SCORING.thresholds,
): PriorityBucket {
  if (score >= thresholds.now) return 'now';
  if (score >= thresholds.next) return 'next';
  if (score >= thresholds.later) return 'later';
  return 'someday';
}

export interface RankableTask extends ScoreInputs {
  id: string;
  manualRank: number | null;
  createdAt: string;
}

/**
 * Ordering for the backlog: pinned tasks first in their pinned order, then by
 * score, then by which is due soonest, then oldest first so the order is total
 * and stable.
 */
export function compareForBacklog(
  a: RankableTask,
  b: RankableTask,
  settings: ScoringSettings = DEFAULT_SCORING,
  today: string = toIsoDate(new Date()),
): number {
  if (a.manualRank != null || b.manualRank != null) {
    if (a.manualRank == null) return 1;
    if (b.manualRank == null) return -1;
    if (a.manualRank !== b.manualRank) return a.manualRank - b.manualRank;
  }

  const scoreDelta = computeScore(b, settings, today) - computeScore(a, settings, today);
  if (scoreDelta !== 0) return scoreDelta;

  // Break score ties by whichever must be acted on first: its relevant date,
  // falling back to the deadline.
  const aDue = relevantDue(a.status, a.dueStartDate, a.dueEndDate).date ?? a.dueEndDate;
  const bDue = relevantDue(b.status, b.dueStartDate, b.dueEndDate).date ?? b.dueEndDate;
  if (aDue !== bDue) {
    if (aDue == null) return 1;
    if (bDue == null) return -1;
    return aDue < bDue ? -1 : 1;
  }

  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}
