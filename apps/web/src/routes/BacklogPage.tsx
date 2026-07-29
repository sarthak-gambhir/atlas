import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Inline,
  Stack,
  Text,
  TruncatedText,
  useToast,
  type DataTableColumn,
} from '@astrabound/duality';
import type { TaskDto } from '@atlas/shared';
import { useMemo, useState } from 'react';

import { BulkActionBar } from '../components/BulkActionBar.tsx';
import { FilterBar } from '../components/FilterBar.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { TaskDrawer } from '../components/TaskDrawer.tsx';
import { describeDueDate } from '../lib/dates.ts';
import { useFilters } from '../lib/filters.ts';
import { STATUS_LABELS } from '../lib/labels.ts';
import { useQuickAdd } from '../lib/quick-add.ts';
import { useCompleteTask, useTasks } from '../lib/tasks.ts';

export function BacklogPage() {
  const filters = useFilters();
  const [selected, setSelected] = useState<TaskDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const openQuickAdd = useQuickAdd();

  const { data: tasks, isPending, error } = useTasks(filters.query);
  const complete = useCompleteTask();
  const { toast } = useToast();

  // A selection outlives a filter change, so only act on rows still on screen.
  const activeSelection = useMemo(
    () => selectedIds.filter((id) => tasks?.some((task) => task.id === id) ?? false),
    [selectedIds, tasks],
  );

  const columns = useMemo<DataTableColumn<TaskDto>[]>(
    () => [
      {
        id: 'title',
        header: 'Task',
        value: (task) => task.title,
        sortable: true,
        cell: (task) => (
          <Stack gap={1}>
            <TruncatedText>{task.title}</TruncatedText>
            {task.tags.length > 0 ? (
              <Inline gap={1}>
                {task.tags.map((tag) => (
                  <Badge key={tag} variant="outline" size="sm">
                    {tag}
                  </Badge>
                ))}
              </Inline>
            ) : null}
          </Stack>
        ),
      },
      {
        id: 'score',
        header: 'Score',
        align: 'end',
        value: (task) => task.score,
        sortable: true,
        cell: (task) => <Badge variant="solid">{task.score}</Badge>,
      },
      {
        id: 'bucket',
        header: 'Priority',
        value: (task) => task.bucket,
        sortable: true,
        cell: (task) => <Badge variant="outline">{task.bucket}</Badge>,
      },
      {
        id: 'due',
        header: 'Due',
        value: (task) => task.dueDate ?? '',
        sortable: true,
        cell: (task) =>
          task.dueDate ? (
            <Stack gap={0}>
              <Text size="sm">{task.dueDate}</Text>
              <Text size="sm">{describeDueDate(task.dueDate)}</Text>
            </Stack>
          ) : (
            <Text size="sm">—</Text>
          ),
      },
      {
        id: 'effort',
        header: 'Impact / Effort',
        align: 'center',
        value: (task) => task.impact - task.effort,
        sortable: true,
        cell: (task) => (
          <Text size="sm" mono>
            {task.impact} / {task.effort}
          </Text>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        value: (task) => task.status,
        sortable: true,
        cell: (task) => <Text size="sm">{STATUS_LABELS[task.status]}</Text>,
      },
      {
        id: 'actions',
        header: '',
        align: 'end',
        cell: (task) =>
          task.status === 'done' ? null : (
            <Button
              size="sm"
              variant="inverse"
              onClick={(event) => {
                event.stopPropagation();
                complete.mutate(task.id, {
                  onSuccess: () => toast({ title: `Completed "${task.title}"`, tone: 'success' }),
                });
              }}
            >
              Done
            </Button>
          ),
      },
    ],
    [complete, toast],
  );

  return (
    <Stack gap={4}>
      <PageHeader
        title="Backlog"
        count={tasks?.length}
        actions={
          <Button variant="solid" onClick={openQuickAdd}>
            New task
          </Button>
        }
      />

      <FilterBar filters={filters} />

      {error ? <Alert tone="error">{error.message}</Alert> : null}

      {activeSelection.length > 0 ? (
        <BulkActionBar ids={activeSelection} onDone={() => setSelectedIds([])} />
      ) : null}

      {!isPending && tasks && tasks.length === 0 ? (
        <EmptyState
          title={filters.isFiltered ? 'Nothing matches' : 'No tasks yet'}
          description={
            filters.isFiltered
              ? 'Try a different search or clear the filters.'
              : 'Add the first task and Atlas will rank it for you.'
          }
          action={
            filters.isFiltered ? null : (
              <Button variant="solid" onClick={openQuickAdd}>
                New task
              </Button>
            )
          }
        />
      ) : (
        <DataTable
          aria-label="Ranked backlog"
          columns={columns}
          data={tasks ?? []}
          getRowId={(task) => task.id}
          filterable={false}
          isLoading={isPending}
          emptyMessage="No tasks match."
          onRowClick={setSelected}
          selectable
          selectedIds={activeSelection}
          onSelectionChange={(ids) => setSelectedIds(ids.map(String))}
          pageSize={20}
        />
      )}

      {selected ? (
        <TaskDrawer key={selected.id} task={selected} onClose={() => setSelected(null)} />
      ) : null}
    </Stack>
  );
}
