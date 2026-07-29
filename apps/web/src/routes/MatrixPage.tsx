import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Grid,
  Inline,
  Stack,
  Text,
  TruncatedText,
} from '@astrabound/duality';
import type { TaskDto } from '@atlas/shared';
import { useMemo, useState, type CSSProperties } from 'react';

import { FilterBar } from '../components/FilterBar.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { TaskDrawer } from '../components/TaskDrawer.tsx';
import { useFilters } from '../lib/filters.ts';
import { useTasks } from '../lib/tasks.ts';

const LEVELS = [1, 2, 3, 4, 5] as const;
/** High impact at the top, so the cheapest wins sit in the top-left. */
const IMPACT_ROWS = [...LEVELS].reverse();

export function MatrixPage() {
  const filters = useFilters();
  const { data: tasks, isPending, error } = useTasks(filters.query);
  const [selected, setSelected] = useState<TaskDto | null>(null);

  const cells = useMemo(() => {
    const grouped = new Map<string, TaskDto[]>();
    for (const task of tasks ?? []) {
      const key = `${task.impact}:${task.effort}`;
      const existing = grouped.get(key);
      if (existing) existing.push(task);
      else grouped.set(key, [task]);
    }
    return grouped;
  }, [tasks]);

  return (
    <Stack gap={4}>
      <PageHeader
        title="Matrix"
        description="Impact down, effort across. The top-left corner is where the cheap wins live."
      />

      <FilterBar filters={filters} />

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
            onOpen={setSelected}
          />
        ))}
      </Grid>

      {selected ? (
        <TaskDrawer key={selected.id} task={selected} onClose={() => setSelected(null)} />
      ) : null}
    </Stack>
  );
}

interface MatrixRowProps {
  impact: number;
  cells: Map<string, TaskDto[]>;
  isPending: boolean;
  onOpen: (task: TaskDto) => void;
}

/** A fragment, so every cell stays a direct child of the one grid. */
function MatrixRow({ impact, cells, isPending, onOpen }: MatrixRowProps) {
  return (
    <>
      <Text size="sm" weight="bold">
        {impact}
      </Text>

      {LEVELS.map((effort) => {
        const inCell = cells.get(`${impact}:${effort}`) ?? [];

        return (
          <Card key={`${impact}:${effort}`}>
            <CardBody>
              {isPending ? (
                <Text size="sm">...</Text>
              ) : inCell.length === 0 ? (
                <Text size="sm">—</Text>
              ) : (
                <Stack gap={1}>
                  <Inline gap={1} align="center" justify="between">
                    <Badge variant="outline" size="sm">
                      {inCell.length}
                    </Badge>
                    <Badge variant="solid" size="sm">
                      {inCell[0]?.score}
                    </Badge>
                  </Inline>

                  {inCell.slice(0, 4).map((task) => (
                    <Button key={task.id} variant="ghost" size="sm" onClick={() => onOpen(task)}>
                      <TruncatedText>{task.title}</TruncatedText>
                    </Button>
                  ))}

                  {inCell.length > 4 ? <Text size="sm">+{inCell.length - 4} more</Text> : null}
                </Stack>
              )}
            </CardBody>
          </Card>
        );
      })}
    </>
  );
}
