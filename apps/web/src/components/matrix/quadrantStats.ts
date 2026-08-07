import { CLOSED_STATUSES, type TaskDto } from '@atlas/shared';

import type { QuadrantStats } from './MatrixQuadrantCard.tsx';

/** Tasks must arrive sorted by score descending. */
export function statsForQuadrant(tasks: TaskDto[]): QuadrantStats {
  const count = tasks.length;
  return {
    count,
    maxScore: count > 0 ? tasks[0]!.score : '—',
    activeCount: tasks.filter(
      (task) => task.status === 'in_progress' || task.status === 'blocked',
    ).length,
    closedCount: tasks.filter((task) => CLOSED_STATUSES.includes(task.status)).length,
  };
}
