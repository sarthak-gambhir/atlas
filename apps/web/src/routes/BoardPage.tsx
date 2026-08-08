import { Alert, Grid, Skeleton, Stack, Stat, StatGroup, Text, useToast } from '@astrabound/duality';
import { CLOSED_STATUSES, type TaskDto, type TaskStatus } from '@atlas/shared';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { BoardBucket } from '../components/board/BoardBucket.tsx';
import { BoardBucketModal } from '../components/board/BoardBucketModal.tsx';
import { TaskFilterToolbar } from '../components/FilterToolbar.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { backState } from '../lib/backNav.ts';
import { todayIso } from '../lib/dates.ts';
import { useFilters } from '../lib/filters.ts';
import { BOARD_STATUSES, STATUS_LABELS } from '../lib/labels.ts';
import { PAGE_ICONS } from '../lib/nav.ts';
import { useTasks, useUpdateTask } from '../lib/tasks.ts';

export function BoardPage() {
  // The board has a Done column, so closed work has to come back from the API.
  const filters = useFilters({ includeClosed: true });
  const { data: tasks, isPending, error } = useTasks(filters.query);
  const update = useUpdateTask();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [openStatus, setOpenStatus] = useState<TaskStatus | null>(null);

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

  // Bucket every task by status (each list sorted by score) so the columns and
  // the modal read from the same derived data.
  const byStatus = useMemo(() => {
    const groups = {} as Record<TaskStatus, TaskDto[]>;
    for (const status of BOARD_STATUSES) groups[status] = [];
    for (const task of tasks ?? []) groups[task.status]?.push(task);
    for (const status of BOARD_STATUSES) groups[status].sort((a, b) => b.score - a.score);
    return groups;
  }, [tasks]);

  const stats = useMemo(() => {
    const today = todayIso();
    const all = tasks ?? [];
    const open = all.filter((task) => !CLOSED_STATUSES.includes(task.status));
    return {
      open: open.length,
      overdue: open.filter((task) => task.dueEndDate != null && task.dueEndDate < today).length,
      done: all.filter((task) => task.status === 'done').length,
    };
  }, [tasks]);

  return (
    <Stack gap={4}>
      <PageHeader
        title="Board"
        icon={PAGE_ICONS.board}
        actions={
          <TaskFilterToolbar
            filters={filters}
            showStatus={false}
            showClosedToggle={false}
            excludeArchived
          />
        }
      />

      <StatGroup>
        <Stat label="Open" value={stats.open} />
        <Stat label="Overdue" value={stats.overdue} />
        <Stat label="Done" value={stats.done} />
      </StatGroup>

      <Text size="sm">
        Active work organized by status, highest-scoring first. Archived tasks are hidden; go to the
        Tasks page and enable "Show archived" to see them.
      </Text>

      {error ? <Alert tone="error">{error.message}</Alert> : null}

      <Grid minChildWidth={320} gap={3} align="start">
        {isPending
          ? BOARD_STATUSES.map((status) => <Skeleton key={status} height={160} />)
          : BOARD_STATUSES.map((status) => (
              <BoardBucket
                key={status}
                status={status}
                tasks={byStatus[status]}
                onViewAll={setOpenStatus}
              />
            ))}
      </Grid>

      {openStatus ? (
        <BoardBucketModal
          status={openStatus}
          tasks={byStatus[openStatus]}
          onClose={() => setOpenStatus(null)}
          onOpenTask={(id) =>
            void navigate(`/tasks/${id}`, {
              state: backState({ label: 'Board', to: location.pathname + location.search }),
            })
          }
          onMove={move}
        />
      ) : null}
    </Stack>
  );
}
