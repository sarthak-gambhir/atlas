import {
  Badge,
  Button,
  DataTable,
  Heading,
  Inline,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Text,
  type DataTableColumn,
} from '@astrabound/duality';
import { useMemo } from 'react';
import type { TaskDto } from '@atlas/shared';

import { describeDueDate } from '../../lib/dates.ts';
import { ScoreCell } from '../ScoreCell.tsx';

interface MatrixCellModalProps {
  impact: number;
  effort: number;
  /** Tasks in this cell, sorted by score descending. */
  tasks: TaskDto[];
  onClose: () => void;
  onOpenTask: (id: string) => void;
}

/** The full task list for one impact/effort cell, as a compact table. */
export function MatrixCellModal({
  impact,
  effort,
  tasks,
  onClose,
  onOpenTask,
}: MatrixCellModalProps) {
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
        value: (task) => task.dueDate ?? '',
        sortable: true,
        cell: (task) => (
          <Text size="sm">{task.dueDate ? describeDueDate(task.dueDate, task.status) : '—'}</Text>
        ),
      },
    ],
    [],
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      showCloseButton
      aria-label={`Impact ${impact}, effort ${effort} tasks`}
    >
      <ModalHeader>
        <Inline gap={2} align="center" justify="start">
          <Heading level={2} visualLevel={4}>
            Impact {impact} / Effort {effort}
          </Heading>
          <Badge variant="outline">{tasks.length}</Badge>
        </Inline>
      </ModalHeader>

      <ModalBody>
        <DataTable
          aria-label={`Impact ${impact}, effort ${effort} tasks`}
          className="atlas-fit-table"
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
