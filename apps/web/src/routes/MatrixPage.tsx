import { Alert, Grid, Skeleton, Stack, Stat, StatGroup, Text } from '@astrabound/duality';
import type { TaskDto } from '@atlas/shared';
import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';

import { FilterBar } from '../components/FilterBar.tsx';
import { MatrixCell } from '../components/matrix/MatrixCell.tsx';
import { MatrixCellModal } from '../components/matrix/MatrixCellModal.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { useFilters } from '../lib/filters.ts';
import { useTasks } from '../lib/tasks.ts';

const LEVELS = [1, 2, 3, 4, 5] as const;
/** High impact at the top, so the cheapest wins sit in the top-left. */
const IMPACT_ROWS = [...LEVELS].reverse();

/** Split at the middle: impact >= 3 is high, effort <= 3 is low. */
const isHighImpact = (task: TaskDto) => task.impact >= 3;
const isLowEffort = (task: TaskDto) => task.effort <= 3;

export function MatrixPage() {
  const filters = useFilters();
  const { data: tasks, isPending, error } = useTasks(filters.query);
  const navigate = useNavigate();
  const [openCell, setOpenCell] = useState<{ impact: number; effort: number } | null>(null);

  // Group by impact:effort, each list sorted by score so the tile shows the top
  // score and the modal reads the same order.
  const cells = useMemo(() => {
    const grouped = new Map<string, TaskDto[]>();
    for (const task of tasks ?? []) {
      const key = `${task.impact}:${task.effort}`;
      const existing = grouped.get(key);
      if (existing) existing.push(task);
      else grouped.set(key, [task]);
    }
    for (const list of grouped.values()) list.sort((a, b) => b.score - a.score);
    return grouped;
  }, [tasks]);

  const quadrants = useMemo(() => {
    const all = tasks ?? [];
    return {
      quickWins: all.filter((t) => isHighImpact(t) && isLowEffort(t)).length,
      bigBets: all.filter((t) => isHighImpact(t) && !isLowEffort(t)).length,
      fillIns: all.filter((t) => !isHighImpact(t) && isLowEffort(t)).length,
      timeSinks: all.filter((t) => !isHighImpact(t) && !isLowEffort(t)).length,
    };
  }, [tasks]);

  const openTasks = openCell
    ? (cells.get(`${openCell.impact}:${openCell.effort}`) ?? [])
    : [];

  return (
    <Stack gap={4}>
      <PageHeader
        title="Matrix"
        description="Impact down, effort across. The top-left corner is where the cheap wins live."
      />

      <FilterBar filters={filters} />

      <StatGroup>
        <Stat label="Quick wins" value={quadrants.quickWins} />
        <Stat label="Big bets" value={quadrants.bigBets} />
        <Stat label="Fill-ins" value={quadrants.fillIns} />
        <Stat label="Time sinks" value={quadrants.timeSinks} />
      </StatGroup>

      <Text size="sm">
        High impact and low effort is a quick win. Click any cell to see its tasks.
      </Text>

      {error ? <Alert tone="error">{error.message}</Alert> : null}

      <Grid
        columns={6}
        gap={2}
        align="stretch"
        // A narrow first column for the impact labels, five equal effort columns.
        style={{ ['--du-cols']: 'minmax(6rem, auto) repeat(5, minmax(0, 1fr))' } as CSSProperties}
      >
        <Text size="sm" weight="bold">
          Impact / Effort
        </Text>
        {LEVELS.map((effort) => (
          <Text key={`head-${effort}`} size="sm" weight="bold" align="center">
            {effort}
          </Text>
        ))}

        {IMPACT_ROWS.map((impact) => (
          <MatrixRow
            key={impact}
            impact={impact}
            cells={cells}
            isPending={isPending}
            onOpen={(i, e) => setOpenCell({ impact: i, effort: e })}
          />
        ))}
      </Grid>

      {openCell ? (
        <MatrixCellModal
          impact={openCell.impact}
          effort={openCell.effort}
          tasks={openTasks}
          onClose={() => setOpenCell(null)}
          onOpenTask={(id) => void navigate(`/tasks/${id}`)}
        />
      ) : null}
    </Stack>
  );
}

interface MatrixRowProps {
  impact: number;
  cells: Map<string, TaskDto[]>;
  isPending: boolean;
  onOpen: (impact: number, effort: number) => void;
}

/** A fragment, so every cell stays a direct child of the one grid. */
function MatrixRow({ impact, cells, isPending, onOpen }: MatrixRowProps) {
  return (
    <>
      <Text size="sm" weight="bold">
        {impact}
      </Text>

      {LEVELS.map((effort) =>
        isPending ? (
          <Skeleton key={`${impact}:${effort}`} height={64} />
        ) : (
          <MatrixCell
            key={`${impact}:${effort}`}
            impact={impact}
            effort={effort}
            tasks={cells.get(`${impact}:${effort}`) ?? []}
            onOpen={onOpen}
          />
        ),
      )}
    </>
  );
}
