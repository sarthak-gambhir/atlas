import {
  Badge,
  Button,
  DataTable,
  Heading,
  Inline,
  Menu,
  MenuItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Text,
  type DataTableColumn,
} from '@astrabound/duality';
import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TaskDto, TaskStatus } from '@atlas/shared';

import { dueLabel } from '../../lib/dates.ts';
import { BOARD_STATUSES, STATUS_LABELS } from '../../lib/labels.ts';
import { useIsMobile } from '../../lib/useIsMobile.ts';
import { ScoreCell } from '../ScoreCell.tsx';
import { TaskMiniList } from '../TaskMiniList.tsx';

interface BoardBucketModalProps {
  status: TaskStatus;
  /** Tasks in this status, sorted by score descending. */
  tasks: TaskDto[];
  onClose: () => void;
  onOpenTask: (id: string) => void;
  onMove: (task: TaskDto, status: TaskStatus) => void;
}

/** The full task list for one board column, as a compact, movable table. */
export function BoardBucketModal({
  status,
  tasks,
  onClose,
  onOpenTask,
  onMove,
}: BoardBucketModalProps) {
  const isMobile = useIsMobile();

  const renderMove = useCallback(
    (task: TaskDto): ReactNode => (
      <Menu
        aria-label={`Move ${task.title}`}
        className="atlas-modal-menu"
        placement="bottom-end"
        trigger={
          <Button size="sm" variant="inverse">
            Move
          </Button>
        }
      >
        {BOARD_STATUSES.filter((option) => option !== status).map((option) => (
          <MenuItem key={option} onSelect={() => onMove(task, option)}>
            {STATUS_LABELS[option]}
          </MenuItem>
        ))}
      </Menu>
    ),
    [status, onMove],
  );

  const columns = useMemo<DataTableColumn<TaskDto>[]>(
    () => [
      {
        id: 'score',
        header: 'Score',
        align: 'end',
        value: (task) => task.score,
        sortable: true,
        cell: (task) => <ScoreCell task={task} />,
      },
      {
        id: 'title',
        header: 'Task',
        value: (task) => task.title,
        sortable: true,
        cell: (task) => <Text size="sm">{task.title}</Text>,
      },
      {
        id: 'due',
        header: 'Due',
        value: (task) => dueLabel(task).date ?? '',
        sortable: true,
        cell: (task) => {
          const label = dueLabel(task);
          if (!label.date) return <Text size="sm">—</Text>;
          return (
            <Inline gap={1} align="center" wrap>
              <Text size="sm">
                {label.prefix} {label.phrase}
              </Text>
              {label.lateStart ? (
                <Badge size="sm" variant="outline">
                  Late start
                </Badge>
              ) : null}
            </Inline>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        align: 'end',
        // Stop the click bubbling to the row (which would navigate) while still
        // letting the trigger's own click open the menu, so use the bubble phase
        // rather than capture.
        cell: (task) => <div onClick={(event) => event.stopPropagation()}>{renderMove(task)}</div>,
      },
    ],
    [renderMove],
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      size={isMobile ? 'full' : 'lg'}
      showCloseButton
      aria-label={`${STATUS_LABELS[status]} tasks`}
    >
      <ModalHeader>
        <Inline gap={2} align="center" justify="start">
          <Heading level={2} visualLevel={4}>
            {STATUS_LABELS[status]}
          </Heading>
          <Badge variant="outline">{tasks.length}</Badge>
        </Inline>
      </ModalHeader>

      <ModalBody>
        {isMobile ? (
          <TaskMiniList tasks={tasks} onOpen={onOpenTask} renderTrailing={renderMove} />
        ) : (
          <DataTable
            aria-label={`${STATUS_LABELS[status]} tasks`}
            className="atlas-actions-table atlas-fit-table"
            columns={columns}
            data={tasks}
            getRowId={(task) => task.id}
            filterable={false}
            emptyMessage="Nothing here."
            onRowClick={(task) => onOpenTask(task.id)}
            pageSize={10}
          />
        )}
      </ModalBody>

      <ModalFooter>
        <Inline gap={2} justify="end">
          <Button variant="solid" onClick={onClose}>
            Close
          </Button>
        </Inline>
      </ModalFooter>
    </Modal>
  );
}
