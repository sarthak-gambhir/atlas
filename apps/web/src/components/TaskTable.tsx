import {
  Alert,
  Badge,
  Button,
  DataTable,
  Inline,
  Stack,
  Text,
  TruncatedText,
  useToast,
  type DataTableColumn,
} from '@astrabound/duality';
import { CLOSED_STATUSES, type TaskDto, type TaskFilter } from '@atlas/shared';
import { useMemo, useState, type ReactNode } from 'react';

import { BucketBadge } from './BucketBadge.tsx';
import { BulkActionBar } from './BulkActionBar.tsx';
import { TaskDrawer } from './TaskDrawer.tsx';
import { describeDueDate } from '../lib/dates.ts';
import { STATUS_LABELS } from '../lib/labels.ts';
import { useCompleteTask, useTasks } from '../lib/tasks.ts';

interface TaskTableProps {
  query: TaskFilter;
  /** Shown when the query returns no rows (and is not loading). */
  emptyState: ReactNode;
  ariaLabel?: string;
  /** Archived-project view: no row editing, selection or Done action. */
  readOnly?: boolean;
}

/**
 * The ranked task table with selection, bulk actions and the edit drawer.
 * Shared by the backlog and the project detail page; the caller owns filtering.
 */
export function TaskTable({
  query,
  emptyState,
  ariaLabel = 'Ranked tasks',
  readOnly = false,
}: TaskTableProps) {
  const [selected, setSelected] = useState<TaskDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: tasks, isPending, error } = useTasks(query);
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
        cell: (task) => <BucketBadge bucket={task.bucket} />,
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
          readOnly || (CLOSED_STATUSES as readonly string[]).includes(task.status) ? null : (
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
    [complete, toast, readOnly],
  );

  return (
    <Stack gap={4}>
      {error ? <Alert tone="error">{error.message}</Alert> : null}

      {!readOnly && activeSelection.length > 0 ? (
        <BulkActionBar ids={activeSelection} onDone={() => setSelectedIds([])} />
      ) : null}

      {!isPending && tasks && tasks.length === 0 ? (
        emptyState
      ) : (
        <DataTable
          aria-label={ariaLabel}
          columns={columns}
          data={tasks ?? []}
          getRowId={(task) => task.id}
          filterable={false}
          isLoading={isPending}
          emptyMessage="No tasks match."
          onRowClick={readOnly ? undefined : setSelected}
          selectable={!readOnly}
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
