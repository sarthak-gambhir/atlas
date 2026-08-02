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
import { useMemo } from 'react';
import type { TaskDto, TaskStatus } from '@atlas/shared';

import { describeDueDate } from '../../lib/dates.ts';
import { BOARD_STATUSES, STATUS_LABELS } from '../../lib/labels.ts';

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
  const columns = useMemo<DataTableColumn<TaskDto>[]>(
    () => [
      {
        id: 'score',
        header: 'Score',
        align: 'end',
        value: (task) => task.score,
        sortable: true,
        cell: (task) => <Badge variant="solid">{task.score}</Badge>,
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
        value: (task) => task.dueDate ?? '',
        sortable: true,
        cell: (task) => <Text size="sm">{task.dueDate ? describeDueDate(task.dueDate) : '—'}</Text>,
      },
      {
        id: 'actions',
        header: '',
        align: 'end',
        cell: (task) => (
          // Stop the click bubbling to the row, which would navigate instead of
          // opening the Move menu.
          <div onClickCapture={(event) => event.stopPropagation()}>
            <Menu
              aria-label={`Move ${task.title}`}
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
          </div>
        ),
      },
    ],
    [status, onMove],
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
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
