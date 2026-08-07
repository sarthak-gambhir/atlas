import type { TaskFilter, TaskStatus } from '@atlas/shared';
import { useMemo, useState } from 'react';

export interface FilterState {
  q: string;
  statuses: TaskStatus[];
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
  projectId: '',
  assigneeId: '',
  tags: [],
  includeClosed: false,
  includeArchived: false,
};

/** Order-independent equality for the array filters. */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
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
  if (state.projectId !== baseline.projectId) count++;
  if (state.assigneeId !== baseline.assigneeId) count++;
  if (!sameSet(state.tags, baseline.tags)) count++;
  if (state.includeClosed !== baseline.includeClosed) count++;
  if (state.includeArchived !== baseline.includeArchived) count++;
  return count;
}

export function useFilters(initial: Partial<FilterState> = {}): UseFilters {
  const baseline: FilterState = { ...EMPTY, ...initial };
  const [state, setState] = useState<FilterState>(baseline);

  const query = useMemo<TaskFilter>(() => {
    const trimmed = state.q.trim();
    return {
      ...(trimmed ? { q: trimmed } : {}),
      ...(state.statuses.length ? { statuses: state.statuses } : {}),
      ...(state.projectId ? { projectId: state.projectId } : {}),
      ...(state.assigneeId ? { assigneeId: state.assigneeId } : {}),
      ...(state.tags.length ? { tags: state.tags } : {}),
      ...(state.includeClosed ? { includeClosed: true } : {}),
      ...(state.includeArchived ? { includeArchived: true } : {}),
    };
  }, [state]);

  // "Filtered" means the user changed something away from the page's baseline
  // (e.g. the board starts with closed included), so Clear has something to do.
  const isFiltered =
    state.q.trim() !== baseline.q ||
    !sameSet(state.statuses, baseline.statuses) ||
    state.projectId !== baseline.projectId ||
    state.assigneeId !== baseline.assigneeId ||
    !sameSet(state.tags, baseline.tags) ||
    state.includeClosed !== baseline.includeClosed ||
    state.includeArchived !== baseline.includeArchived;

  const activeCount = countActive(state, baseline);

  return {
    state,
    set: (patch) => setState((previous) => ({ ...previous, ...patch })),
    clear: () => setState(baseline),
    query,
    isFiltered,
    activeCount,
  };
}
