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

import { dueLabel } from '../../lib/dates.ts';
import { useIsMobile } from '../../lib/useIsMobile.ts';
import { ScoreCell } from '../ScoreCell.tsx';
import { TaskMiniList } from '../TaskMiniList.tsx';

interface MatrixQuadrantModalProps {
  label: string;
  /** Tasks in this quadrant, sorted by score descending. */
  tasks: TaskDto[];
  onClose: () => void;
  onOpenTask: (id: string) => void;
}

/** The full task list for one impact/effort quadrant. */
export function MatrixQuadrantModal({ label, tasks, onClose, onOpenTask }: MatrixQuadrantModalProps) {
  const isMobile = useIsMobile();
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
          const due = dueLabel(task);
          if (!due.date) return <Text size="sm">—</Text>;
          return (
            <Inline gap={1} align="center" wrap>
              <Text size="sm">
                {due.prefix} {due.phrase}
              </Text>
              {due.lateStart ? (
                <Badge size="sm" variant="outline">
                  Late start
                </Badge>
              ) : null}
            </Inline>
          );
        },
      },
    ],
    [],
  );

  return (
    <Modal isOpen onClose={onClose} size={isMobile ? 'full' : 'xl'} showCloseButton aria-label={label}>
      <ModalHeader>
        <Inline gap={2} align="center" justify="start">
          <Heading level={2} visualLevel={4}>
            {label}
          </Heading>
          <Badge variant="outline">{tasks.length}</Badge>
        </Inline>
      </ModalHeader>

      <ModalBody>
        {isMobile ? (
          <TaskMiniList tasks={tasks} onOpen={onOpenTask} />
        ) : (
          <DataTable
            aria-label={`${label} tasks`}
            className="atlas-fit-table"
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
