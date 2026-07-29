import {
  Badge,
  Button,
  Card,
  CardBody,
  Inline,
  Menu,
  MenuItem,
  Stack,
  Text,
  TruncatedText,
} from '@astrabound/duality';
import type { TaskDto, TaskStatus } from '@atlas/shared';

import { describeDueDate } from '../lib/dates.ts';
import { BOARD_STATUSES, STATUS_LABELS } from '../lib/labels.ts';

interface TaskCardProps {
  task: TaskDto;
  onOpen: (task: TaskDto) => void;
  onMove: (task: TaskDto, status: TaskStatus) => void;
}

export function TaskCard({ task, onOpen, onMove }: TaskCardProps) {
  return (
    <Card>
      <CardBody>
        <Stack gap={2}>
          <Inline gap={2} align="center" justify="between">
            <Inline gap={1} align="center">
              <Badge variant="solid">{task.score}</Badge>
              <Badge variant="outline" size="sm">
                {task.impact}/{task.effort}
              </Badge>
            </Inline>

            <Menu
              aria-label={`Move ${task.title}`}
              placement="bottom-end"
              trigger={
                <Button size="sm" variant="ghost">
                  Move
                </Button>
              }
            >
              {BOARD_STATUSES.filter((status) => status !== task.status).map((status) => (
                <MenuItem key={status} onSelect={() => onMove(task, status)}>
                  {STATUS_LABELS[status]}
                </MenuItem>
              ))}
            </Menu>
          </Inline>

          <Button variant="ghost" size="sm" onClick={() => onOpen(task)}>
            <TruncatedText lines={2}>{task.title}</TruncatedText>
          </Button>

          {task.dueDate ? <Text size="sm">Due {describeDueDate(task.dueDate)}</Text> : null}

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
      </CardBody>
    </Card>
  );
}
