import type { TaskFilter, TaskStatus } from '@atlas/shared';
import { useMemo, useState } from 'react';

export interface FilterState {
  q: string;
  status: TaskStatus | '';
  projectId: string;
  assigneeId: string;
  tag: string;
  includeClosed: boolean;
}

const EMPTY: FilterState = {
  q: '',
  status: '',
  projectId: '',
  assigneeId: '',
  tag: '',
  includeClosed: false,
};

export interface UseFilters {
  state: FilterState;
  set: (patch: Partial<FilterState>) => void;
  clear: () => void;
  /** Only the parts the API cares about, with blanks dropped. */
  query: TaskFilter;
  isFiltered: boolean;
}

export function useFilters(initial: Partial<FilterState> = {}): UseFilters {
  const baseline: FilterState = { ...EMPTY, ...initial };
  const [state, setState] = useState<FilterState>(baseline);

  const query = useMemo<TaskFilter>(() => {
    const trimmed = state.q.trim();
    return {
      ...(trimmed ? { q: trimmed } : {}),
      ...(state.status ? { status: state.status } : {}),
      ...(state.projectId ? { projectId: state.projectId } : {}),
      ...(state.assigneeId ? { assigneeId: state.assigneeId } : {}),
      ...(state.tag ? { tag: state.tag } : {}),
      ...(state.includeClosed ? { includeClosed: true } : {}),
    };
  }, [state]);

  // "Filtered" means the user changed something away from the page's baseline
  // (e.g. the board starts with closed included), so Clear has something to do.
  const isFiltered =
    state.q.trim() !== baseline.q ||
    state.status !== baseline.status ||
    state.projectId !== baseline.projectId ||
    state.assigneeId !== baseline.assigneeId ||
    state.tag !== baseline.tag ||
    state.includeClosed !== baseline.includeClosed;

  return {
    state,
    set: (patch) => setState((previous) => ({ ...previous, ...patch })),
    clear: () => setState(baseline),
    query,
    isFiltered,
  };
}
