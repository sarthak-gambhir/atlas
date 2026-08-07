import {
  PRIORITY_BUCKETS,
  TASK_STATUSES,
  type PriorityBucket,
  type TaskFilter,
  type TaskStatus,
} from '@atlas/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export interface FilterState {
  q: string;
  statuses: TaskStatus[];
  buckets: PriorityBucket[];
  projectId: string;
  assigneeId: string;
  tags: string[];
  /** Include completed (`done`) tasks. */
  includeClosed: boolean;
  /** Include archived tasks (independent of `done`). */
  includeArchived: boolean;
}

const EMPTY: FilterState = {
  q: '',
  statuses: [],
  buckets: [],
  projectId: '',
  assigneeId: '',
  tags: [],
  includeClosed: false,
  includeArchived: false,
};

/** Query-string keys `useFilters` owns; anything else on the URL is preserved. */
const OWNED_KEYS = [
  'q',
  'statuses',
  'buckets',
  'projectId',
  'assigneeId',
  'tags',
  'includeClosed',
  'includeArchived',
] as const;

/** Order-independent equality for the array filters. */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

// Rough UUID check so a hand-edited id can't reach the API and trip its uuid
// schema (which would 400 the whole list). Facets already hide unknown options.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOr(value: string | null, fallback: string): string {
  return value != null && UUID_RE.test(value) ? value : fallback;
}

/** Read a view's filter state from the URL, falling back to its baseline. */
function decode(params: URLSearchParams, baseline: FilterState): FilterState {
  const statuses = params.getAll('statuses').filter((v): v is TaskStatus =>
    (TASK_STATUSES as readonly string[]).includes(v),
  );
  const buckets = params.getAll('buckets').filter((v): v is PriorityBucket =>
    (PRIORITY_BUCKETS as readonly string[]).includes(v),
  );
  const tags = params.getAll('tags').filter((v) => v !== '');
  return {
    q: params.get('q') ?? baseline.q,
    statuses: statuses.length ? statuses : baseline.statuses,
    buckets: buckets.length ? buckets : baseline.buckets,
    projectId: uuidOr(params.get('projectId'), baseline.projectId),
    assigneeId: uuidOr(params.get('assigneeId'), baseline.assigneeId),
    tags: tags.length ? tags : baseline.tags,
    includeClosed: params.has('includeClosed')
      ? params.get('includeClosed') === 'true'
      : baseline.includeClosed,
    includeArchived: params.has('includeArchived')
      ? params.get('includeArchived') === 'true'
      : baseline.includeArchived,
  };
}

/** Serialize only the fields that differ from the baseline, so URLs stay minimal. */
function writeOwned(params: URLSearchParams, next: FilterState, baseline: FilterState): void {
  for (const key of OWNED_KEYS) params.delete(key);

  if (next.q.trim() !== baseline.q && next.q.trim()) params.set('q', next.q);
  if (!sameSet(next.statuses, baseline.statuses)) {
    for (const status of next.statuses) params.append('statuses', status);
  }
  if (!sameSet(next.buckets, baseline.buckets)) {
    for (const bucket of next.buckets) params.append('buckets', bucket);
  }
  if (next.projectId !== baseline.projectId && next.projectId) {
    params.set('projectId', next.projectId);
  }
  if (next.assigneeId !== baseline.assigneeId && next.assigneeId) {
    params.set('assigneeId', next.assigneeId);
  }
  if (!sameSet(next.tags, baseline.tags)) {
    for (const tag of next.tags) params.append('tags', tag);
  }
  if (next.includeClosed !== baseline.includeClosed) {
    params.set('includeClosed', String(next.includeClosed));
  }
  if (next.includeArchived !== baseline.includeArchived) {
    params.set('includeArchived', String(next.includeArchived));
  }
}

export interface UseFilters {
  state: FilterState;
  set: (patch: Partial<FilterState>) => void;
  clear: () => void;
  /** Only the parts the API cares about, with blanks dropped. */
  query: TaskFilter;
  isFiltered: boolean;
  /** Number of fields changed away from the page baseline. */
  activeCount: number;
}

function countActive(state: FilterState, baseline: FilterState): number {
  let count = 0;
  if (state.q.trim() !== baseline.q) count++;
  if (!sameSet(state.statuses, baseline.statuses)) count++;
  if (!sameSet(state.buckets, baseline.buckets)) count++;
  if (state.projectId !== baseline.projectId) count++;
  if (state.assigneeId !== baseline.assigneeId) count++;
  if (!sameSet(state.tags, baseline.tags)) count++;
  if (state.includeClosed !== baseline.includeClosed) count++;
  if (state.includeArchived !== baseline.includeArchived) count++;
  return count;
}

/**
 * View filters backed by the route's query string, so they survive reload and
 * navigation and are shareable. `initial` sets the page baseline (e.g. the board
 * includes closed tasks); only deviations from it are written to the URL.
 */
export function useFilters(initial: Partial<FilterState> = {}): UseFilters {
  const [params, setParams] = useSearchParams();
  // Callers pass a fresh `initial` object literal each render, so key the memo on
  // its contents (not identity) to keep `baseline` — and everything derived from
  // it — stable across renders.
  const initialKey = JSON.stringify(initial);
  const baseline = useMemo<FilterState>(
    () => ({ ...EMPTY, ...initial }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialKey],
  );

  const state = useMemo(() => decode(params, baseline), [params, baseline]);

  const set = useCallback(
    (patch: Partial<FilterState>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          writeOwned(next, { ...decode(prev, baseline), ...patch }, baseline);
          return next;
        },
        { replace: true },
      );
    },
    [baseline, setParams],
  );

  const clear = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of OWNED_KEYS) next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  const query = useMemo<TaskFilter>(() => {
    const trimmed = state.q.trim();
    return {
      ...(trimmed ? { q: trimmed } : {}),
      ...(state.statuses.length ? { statuses: state.statuses } : {}),
      ...(state.buckets.length ? { buckets: state.buckets } : {}),
      ...(state.projectId ? { projectId: state.projectId } : {}),
      ...(state.assigneeId ? { assigneeId: state.assigneeId } : {}),
      ...(state.tags.length ? { tags: state.tags } : {}),
      ...(state.includeClosed ? { includeClosed: true } : {}),
      ...(state.includeArchived ? { includeArchived: true } : {}),
    };
  }, [state]);

  // "Filtered" means the user changed something away from the page's baseline
  // (e.g. the board starts with closed included), so Clear has something to do.
  const isFiltered = countActive(state, baseline) > 0;
  const activeCount = countActive(state, baseline);

  return { state, set, clear, query, isFiltered, activeCount };
}
