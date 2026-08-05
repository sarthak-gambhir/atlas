import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DataTable,
  Inline,
  Skeleton,
  Stack,
  Text,
  TruncatedText,
  useToast,
  type DataTableColumn,
} from '@astrabound/duality';
import { type TaskDto, type TaskFilter } from '@atlas/shared';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { BucketBadge } from './BucketBadge.tsx';
import { BulkActionBar } from './BulkActionBar.tsx';
import { ScoreCell } from './ScoreCell.tsx';
import { dueLabel } from '../lib/dates.ts';
import { STATUS_LABELS } from '../lib/labels.ts';
import { useCompleteTask, useTasks, useUpdateTask } from '../lib/tasks.ts';
import { useIsMobile } from '../lib/useIsMobile.ts';

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  // Set during click capture when the click lands on a selection checkbox, so
  // the row's own click handler skips navigation for that one event.
  const skipRowClickRef = useRef(false);

  const { data: tasks, isPending, error } = useTasks(query);
  const complete = useCompleteTask();
  const update = useUpdateTask();
  const { toast } = useToast();

  // A selection outlives a filter change, so only act on rows still on screen.
  const activeSelection = useMemo(
    () => selectedIds.filter((id) => tasks?.some((task) => task.id === id) ?? false),
    [selectedIds, tasks],
  );

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
    );
  }, []);

  // The status-dependent row action (Done / Archive / Restore), shared by the
  // desktop table's actions column and the mobile card list. Returns null in a
  // read-only (archived-project) view.
  const renderRowAction = useCallback(
    (task: TaskDto): ReactNode => {
      if (readOnly) return null;

      if (task.status === 'archived') {
        return (
          <Button
            size="sm"
            variant="inverse"
            onClick={(event) => {
              event.stopPropagation();
              // A previously completed task returns to done; otherwise it goes
              // back to the backlog.
              update.mutate(
                { id: task.id, status: task.completedAt ? 'done' : 'backlog' },
                {
                  onSuccess: () => toast({ title: `Restored "${task.title}"`, tone: 'success' }),
                  onError: (cause) =>
                    toast({
                      title: 'Could not restore',
                      description: cause.message,
                      tone: 'error',
                    }),
                },
              );
            }}
          >
            Restore
          </Button>
        );
      }

      if (task.status === 'done') {
        return (
          <Button
            size="sm"
            variant="inverse"
            onClick={(event) => {
              event.stopPropagation();
              update.mutate(
                { id: task.id, status: 'archived' },
                {
                  onSuccess: () => toast({ title: `Archived "${task.title}"`, tone: 'success' }),
                  onError: (cause) =>
                    toast({
                      title: 'Could not archive',
                      description: cause.message,
                      tone: 'error',
                    }),
                },
              );
            }}
          >
            Archive
          </Button>
        );
      }

      return (
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
      );
    },
    [complete, update, toast, readOnly],
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
        header: <span style={{ display: 'inline-block', minInlineSize: '10ch' }}>Due</span>,
        value: (task) => dueLabel(task).date ?? '',
        sortable: true,
        cell: (task) => {
          const label = dueLabel(task);
          if (!label.date) return <Text size="sm">—</Text>;
          // Far-off dates have no relative phrase (describeDueDate echoes the
          // date), so only add the second line when it says something new.
          return (
            <Stack gap={0}>
              <Text size="sm">
                {label.prefix} {label.date}
              </Text>
              {label.phrase !== label.date ? <Text size="sm">{label.phrase}</Text> : null}
              {label.lateStart ? (
                <Badge size="sm" variant="outline">
                  Should have started
                </Badge>
              ) : null}
            </Stack>
          );
        },
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
        id: 'completed',
        header: 'Completed',
        value: (task) => task.completedAt ?? '',
        sortable: true,
        cell: (task) => (
          <Text size="sm">{task.completedAt ? task.completedAt.slice(0, 10) : '—'}</Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        align: 'end',
        cell: (task) => renderRowAction(task),
      },
    ],
    [renderRowAction],
  );

  return (
    <Stack gap={4}>
      {error ? <Alert tone="error">{error.message}</Alert> : null}

      {!readOnly && activeSelection.length > 0 ? (
        <BulkActionBar ids={activeSelection} onDone={() => setSelectedIds([])} />
      ) : null}

      {!isPending && tasks && tasks.length === 0 ? (
        emptyState
      ) : isMobile ? (
        <TaskCardList
          tasks={tasks ?? []}
          isLoading={isPending}
          selectable={!readOnly}
          selectedIds={activeSelection}
          onToggle={toggleOne}
          onToggleAll={(checked) =>
            setSelectedIds(checked ? (tasks ?? []).map((task) => task.id) : [])
          }
          renderAction={renderRowAction}
          onOpen={(id) => void navigate(`/tasks/${id}`)}
        />
      ) : (
        <div
          onClickCapture={(event) => {
            // A click on the selection checkbox must toggle it, not navigate.
            // Flag it here (without stopping the event, which would also stop
            // the checkbox from toggling) and let onRowClick skip this event.
            skipRowClickRef.current =
              (event.target as HTMLElement).closest('.du_data_table_select_cell') != null;
            // Clear after this dispatch so it can't stale-block a later
            // keyboard row activation, which fires no click event.
            queueMicrotask(() => {
              skipRowClickRef.current = false;
            });
          }}
        >
          <DataTable
            aria-label={ariaLabel}
            columns={columns}
            data={tasks ?? []}
            getRowId={(task) => task.id}
            filterable={false}
            isLoading={isPending}
            emptyMessage="No tasks match."
            onRowClick={(task) => {
              if (skipRowClickRef.current) return;
              void navigate(`/tasks/${task.id}`);
            }}
            selectable={!readOnly}
            selectedIds={activeSelection}
            onSelectionChange={(ids) => setSelectedIds(ids.map(String))}
            pageSize={10}
          />
        </div>
      )}
    </Stack>
  );
}

interface TaskCardListProps {
  tasks: TaskDto[];
  isLoading: boolean;
  selectable: boolean;
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  renderAction: (task: TaskDto) => ReactNode;
  onOpen: (id: string) => void;
}

/** The phone-layout replacement for the task DataTable: one card per task. */
function TaskCardList({
  tasks,
  isLoading,
  selectable,
  selectedIds,
  onToggle,
  onToggleAll,
  renderAction,
  onOpen,
}: TaskCardListProps) {
  if (isLoading && tasks.length === 0) {
    return (
      <Stack gap={2}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={96} />
        ))}
      </Stack>
    );
  }

  const selectedSet = new Set(selectedIds);
  const allSelected = tasks.length > 0 && tasks.every((task) => selectedSet.has(task.id));
  const someSelected = tasks.some((task) => selectedSet.has(task.id));

  return (
    <Stack gap={2}>
      {selectable && tasks.length > 0 ? (
        <Inline justify="start">
          <Checkbox
            label={allSelected ? 'Deselect all' : 'Select all'}
            checked={allSelected}
            indeterminate={!allSelected && someSelected}
            onChange={(event) => onToggleAll(event.target.checked)}
          />
        </Inline>
      ) : null}

      {tasks.map((task) => {
        const label = dueLabel(task);
        return (
          <div
            key={task.id}
            className="atlas-task-card"
            role="button"
            tabIndex={0}
            onClick={() => onOpen(task.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen(task.id);
              }
            }}
          >
            <div
              className="atlas-task-card__accent"
              onClick={
                selectable
                  ? (event) => {
                      // The accent is the selection zone: clicking anywhere in it
                      // toggles the checkbox instead of opening the task.
                      event.stopPropagation();
                      onToggle(task.id, !selectedSet.has(task.id));
                    }
                  : undefined
              }
            >
              {selectable ? (
                // The checkbox toggles itself, so keep its click from also
                // reaching the accent (which would toggle a second time).
                <span onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    aria-label={`Select "${task.title}"`}
                    checked={selectedSet.has(task.id)}
                    onChange={(event) => onToggle(task.id, event.target.checked)}
                  />
                </span>
              ) : null}
            </div>

            <div className="atlas-task-card__body">
              <div className="atlas-task-card__section">
                <Inline gap={2} align="center" wrap>
                  <Text weight="bold">{task.title}</Text>
                  {label.lateStart ? (
                    <Badge size="sm" variant="outline">
                      Should have started
                    </Badge>
                  ) : null}
                </Inline>
              </div>

              <div className="atlas-task-card__section atlas-task-card__facts">
                <div className="atlas-task-card__fact">
                  {task.completedAt ? (
                    <>
                      <Text size="sm">Completed:</Text>
                      <Text size="sm" weight="bold">
                        {task.completedAt.slice(0, 10)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text size="sm">{label.prefix}:</Text>
                      <Text size="sm" weight="bold">
                        {label.phrase || '—'}
                      </Text>
                    </>
                  )}
                </div>

                <div className="atlas-task-card__fact">
                  <Text size="sm">Impact / Effort:</Text>
                  <Text size="sm" weight="bold" mono>
                    {task.impact} / {task.effort}
                  </Text>
                </div>

                <div className="atlas-task-card__fact">
                  <Text size="sm">Score:</Text>
                  <ScoreCell task={task} />
                </div>

                <div className="atlas-task-card__fact">
                  <Text size="sm">Priority:</Text>
                  <span>
                    <BucketBadge bucket={task.bucket} />
                  </span>
                </div>
              </div>

              {task.tags.length > 0 ? (
                <div className="atlas-task-card__section">
                  <Inline gap={1} wrap>
                    <Text size="sm">Tags:</Text>
                    {task.tags.map((tag) => (
                      <Badge key={tag} variant="outline" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </Inline>
                </div>
              ) : null}

              <div className="atlas-task-card__section">
                <Inline gap={2} align="center" justify="between">
                  <Inline gap={2} align="center">
                    <Text size="sm">Status:</Text>
                    <Text size="sm" weight="bold">
                      {STATUS_LABELS[task.status]}
                    </Text>
                  </Inline>
                  {renderAction(task)}
                </Inline>
              </div>
            </div>
          </div>
        );
      })}
    </Stack>
  );
}
