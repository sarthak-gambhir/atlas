import {
  Alert,
  Badge,
  Divider,
  Grid,
  Inline,
  Skeleton,
  Stack,
  Text,
  useToast,
} from '@astrabound/duality';
import type { TaskDto, TaskStatus } from '@atlas/shared';
import { useState } from 'react';

import { FilterBar } from '../components/FilterBar.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { TaskCard } from '../components/TaskCard.tsx';
import { TaskDrawer } from '../components/TaskDrawer.tsx';
import { useFilters } from '../lib/filters.ts';
import { BOARD_STATUSES, STATUS_LABELS } from '../lib/labels.ts';
import { useTasks, useUpdateTask } from '../lib/tasks.ts';

export function BoardPage() {
  // The board has a Done column, so closed work has to come back from the API.
  const filters = useFilters({ includeClosed: true });
  const { data: tasks, isPending, error } = useTasks(filters.query);
  const update = useUpdateTask();
  const { toast } = useToast();
  const [selected, setSelected] = useState<TaskDto | null>(null);

  const move = (task: TaskDto, status: TaskStatus) => {
    update.mutate(
      { id: task.id, status },
      {
        onSuccess: () => toast({ title: `Moved to ${STATUS_LABELS[status]}`, tone: 'success' }),
        onError: (cause) =>
          toast({ title: 'Could not move task', description: cause.message, tone: 'error' }),
      },
    );
  };

  return (
    <Stack gap={4}>
      <PageHeader title="Board" />

      <FilterBar filters={filters} showStatus={false} />

      {error ? <Alert tone="error">{error.message}</Alert> : null}

      <Grid minChildWidth={240} gap={3} align="start">
        {BOARD_STATUSES.map((status) => {
          const column = (tasks ?? []).filter((task) => task.status === status);

          return (
            <Stack key={status} gap={2}>
              <Inline gap={2} align="center" justify="between">
                <Text weight="bold">{STATUS_LABELS[status]}</Text>
                <Badge variant="outline">{column.length}</Badge>
              </Inline>

              <Divider decorative />

              {isPending ? (
                <Skeleton height={72} />
              ) : column.length === 0 ? (
                <Text size="sm">Nothing here</Text>
              ) : (
                <Stack gap={2}>
                  {column.map((task) => (
                    <TaskCard key={task.id} task={task} onOpen={setSelected} onMove={move} />
                  ))}
                </Stack>
              )}
            </Stack>
          );
        })}
      </Grid>

      {selected ? (
        <TaskDrawer key={selected.id} task={selected} onClose={() => setSelected(null)} />
      ) : null}
    </Stack>
  );
}
