import { Text } from '@astrabound/duality';
import type { TaskDto } from '@atlas/shared';

interface MatrixCellProps {
  impact: number;
  effort: number;
  /** Tasks in this impact/effort cell, sorted by score descending. */
  tasks: TaskDto[];
  onOpen: (impact: number, effort: number) => void;
}

/** One impact/effort cell: two blocks (Tasks | Top score) that open a modal. */
export function MatrixCell({ impact, effort, tasks, onOpen }: MatrixCellProps) {
  if (tasks.length === 0) {
    return (
      <div className="atlas-matrix-tile atlas-matrix-tile--empty">
        <Text size="sm">—</Text>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="atlas-matrix-tile atlas-matrix-tile--cell"
      aria-label={`Impact ${impact}, effort ${effort}: ${tasks.length} ${
        tasks.length === 1 ? 'task' : 'tasks'
      }, top score ${tasks[0]!.score}`}
      onClick={() => onOpen(impact, effort)}
    >
      <span className="atlas-matrix-cell__block">
        <Text size="sm">Tasks</Text>
        <Text size="sm" weight="bold">
          {tasks.length}
        </Text>
      </span>
      <span className="atlas-matrix-cell__block atlas-matrix-cell__block--invert">
        <Text size="sm">Top score</Text>
        <Text size="sm" weight="bold">
          {tasks[0]!.score}
        </Text>
      </span>
    </button>
  );
}
