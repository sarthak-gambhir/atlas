import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCORING,
  bucketFor,
  compareForBacklog,
  computeScore,
  daysBetween,
  toIsoDate,
  urgencyFor,
  type RankableTask,
  type ScoreInputs,
} from './score.ts';

const TODAY = '2026-07-28';

function task(overrides: Partial<ScoreInputs> = {}): ScoreInputs {
  return {
    impact: 3,
    effort: 3,
    confidence: 1,
    dueDate: null,
    urgencyOverride: null,
    ...overrides,
  };
}

function rankable(id: string, overrides: Partial<RankableTask> = {}): RankableTask {
  return {
    id,
    manualRank: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...task(),
    ...overrides,
  };
}

describe('daysBetween', () => {
  it('counts whole days forward and backward', () => {
    expect(daysBetween(TODAY, '2026-07-31')).toBe(3);
    expect(daysBetween(TODAY, TODAY)).toBe(0);
    expect(daysBetween(TODAY, '2026-07-27')).toBe(-1);
  });

  it('is unaffected by daylight saving transitions', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('rejects malformed dates', () => {
    expect(() => daysBetween(TODAY, 'not-a-date')).toThrow(RangeError);
  });
});

describe('urgencyFor', () => {
  it('puts undated work at the floor', () => {
    expect(urgencyFor(null, null, TODAY)).toBe(1);
  });

  it('treats overdue and due-today alike at the ceiling', () => {
    expect(urgencyFor('2026-07-01', null, TODAY)).toBe(5);
    expect(urgencyFor(TODAY, null, TODAY)).toBe(5);
  });

  it('steps down as the due date recedes', () => {
    expect(urgencyFor('2026-07-31', null, TODAY)).toBe(4); // 3 days
    expect(urgencyFor('2026-08-04', null, TODAY)).toBe(3); // 7 days
    expect(urgencyFor('2026-08-27', null, TODAY)).toBe(2); // 30 days
    expect(urgencyFor('2026-09-30', null, TODAY)).toBe(1); // beyond a month
  });

  it('lets an override win over the due date', () => {
    expect(urgencyFor('2027-01-01', 5, TODAY)).toBe(5);
    expect(urgencyFor(TODAY, 1, TODAY)).toBe(1);
  });

  it('clamps out-of-range overrides', () => {
    expect(urgencyFor(null, 0, TODAY)).toBe(1);
    expect(urgencyFor(null, 99, TODAY)).toBe(5);
  });
});

describe('computeScore', () => {
  it('rewards impact and punishes effort', () => {
    const cheap = computeScore(task({ impact: 5, effort: 1 }), DEFAULT_SCORING, TODAY);
    const expensive = computeScore(task({ impact: 5, effort: 5 }), DEFAULT_SCORING, TODAY);
    expect(cheap).toBeGreaterThan(expensive);
  });

  it('scales down with confidence', () => {
    const base = task({ impact: 5, effort: 1, dueDate: TODAY });
    const sure = computeScore({ ...base, confidence: 1 }, DEFAULT_SCORING, TODAY);
    const unsure = computeScore({ ...base, confidence: 0.5 }, DEFAULT_SCORING, TODAY);
    expect(sure).toBe(10);
    expect(unsure).toBe(5);
  });

  it('tops out at 10 for maximum value and minimum cost', () => {
    const best = task({ impact: 5, effort: 1, confidence: 1, dueDate: TODAY });
    expect(computeScore(best, DEFAULT_SCORING, TODAY)).toBe(10);
  });

  it('honours reweighting', () => {
    const dated = task({ impact: 1, dueDate: TODAY });
    const balanced = computeScore(dated, DEFAULT_SCORING, TODAY);
    const urgencyLed = computeScore(
      dated,
      { ...DEFAULT_SCORING, weights: { impact: 1, urgency: 3 } },
      TODAY,
    );
    expect(urgencyLed).toBeGreaterThan(balanced);
  });

  it('never divides by zero', () => {
    expect(Number.isFinite(computeScore(task({ effort: 0 }), DEFAULT_SCORING, TODAY))).toBe(true);
  });

  it('defaults today to the current UTC date', () => {
    const overdue = task({ dueDate: '2000-01-01' });
    expect(computeScore(overdue)).toBe(computeScore(overdue, DEFAULT_SCORING, toIsoDate(new Date())));
  });
});

describe('bucketFor', () => {
  it('maps scores onto buckets at the threshold boundaries', () => {
    expect(bucketFor(10)).toBe('now');
    expect(bucketFor(6)).toBe('now');
    expect(bucketFor(5.9)).toBe('next');
    expect(bucketFor(4)).toBe('next');
    expect(bucketFor(2)).toBe('later');
    expect(bucketFor(1.9)).toBe('someday');
  });
});

describe('compareForBacklog', () => {
  const sorted = (tasks: RankableTask[]) =>
    [...tasks].sort((a, b) => compareForBacklog(a, b, DEFAULT_SCORING, TODAY)).map((t) => t.id);

  it('ranks higher scores first', () => {
    const high = rankable('high', { impact: 5, effort: 1 });
    const low = rankable('low', { impact: 1, effort: 5 });
    expect(sorted([low, high])).toEqual(['high', 'low']);
  });

  it('floats pinned tasks above unpinned ones regardless of score', () => {
    const pinned = rankable('pinned', { impact: 1, effort: 5, manualRank: 1 });
    const strong = rankable('strong', { impact: 5, effort: 1 });
    expect(sorted([strong, pinned])).toEqual(['pinned', 'strong']);
  });

  it('orders pinned tasks among themselves by rank', () => {
    const first = rankable('first', { manualRank: 1 });
    const second = rankable('second', { manualRank: 2 });
    expect(sorted([second, first])).toEqual(['first', 'second']);
  });

  it('breaks score ties with the nearest due date', () => {
    const soon = rankable('soon', { dueDate: '2026-08-04', urgencyOverride: 3 });
    const later = rankable('later', { dueDate: '2026-08-05', urgencyOverride: 3 });
    expect(sorted([later, soon])).toEqual(['soon', 'later']);
  });

  it('breaks remaining ties with age, oldest first', () => {
    const older = rankable('older', { createdAt: '2026-01-01T00:00:00.000Z' });
    const newer = rankable('newer', { createdAt: '2026-06-01T00:00:00.000Z' });
    expect(sorted([newer, older])).toEqual(['older', 'newer']);
  });

  it('is a total order, so sorting is stable across input permutations', () => {
    const tasks = [
      rankable('a', { impact: 4, effort: 2 }),
      rankable('b', { impact: 2, effort: 1, manualRank: 5 }),
      rankable('c', { impact: 4, effort: 2, createdAt: '2025-01-01T00:00:00.000Z' }),
      rankable('d', { impact: 1, effort: 4, dueDate: TODAY }),
    ];
    const expected = sorted(tasks);
    expect(sorted([...tasks].reverse())).toEqual(expected);
  });
});
