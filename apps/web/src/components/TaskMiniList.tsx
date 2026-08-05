import { Badge, Inline, Stack, Text } from '@astrabound/duality';
import type { TaskDto } from '@atlas/shared';
import type { ReactNode } from 'react';

import { dueLabel } from '../lib/dates.ts';
import { ScoreCell } from './ScoreCell.tsx';

interface TaskMiniListProps {
  tasks: TaskDto[];
  onOpen: (id: string) => void;
  /** Optional trailing control per card, e.g. the board's Move menu. */
  renderTrailing?: (task: TaskDto) => ReactNode;
  emptyMessage?: string;
}

/**
 * The phone-layout replacement for the compact task tables inside the board and
 * matrix detail modals: one tappable card per task (score, title, due).
 */
export function TaskMiniList({
  tasks,
  onOpen,
  renderTrailing,
  emptyMessage = 'Nothing here.',
}: TaskMiniListProps) {
  if (tasks.length === 0) {
    return <Text size="sm">{emptyMessage}</Text>;
  }

  return (
    <Stack gap={2}>
      {tasks.map((task) => {
        const label = dueLabel(task);
        return (
          <div
            key={task.id}
            className="atlas-record-card"
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
            <Inline gap={2} align="start" justify="between" wrap={false}>
              <Stack gap={1} style={{ minWidth: 0 }}>
                <Text weight="bold">{task.title}</Text>
                {label.date ? (
                  <Inline gap={1} align="center" wrap>
                    <Text size="sm">
                      {label.prefix} {label.phrase}
                    </Text>
                    {label.lateStart ? (
                      <Badge size="sm" variant="outline">
                        Should have started
                      </Badge>
                    ) : null}
                  </Inline>
                ) : null}
              </Stack>

              <Inline gap={2} align="center" wrap={false}>
                <ScoreCell task={task} />
                {renderTrailing ? (
                  <span onClick={(event) => event.stopPropagation()}>{renderTrailing(task)}</span>
                ) : null}
              </Inline>
            </Inline>
          </div>
        );
      })}
    </Stack>
  );
}
