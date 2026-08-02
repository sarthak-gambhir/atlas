import { Badge, Button, Card, CardBody, Inline, Stack, Stat, StatGroup, Text } from '@astrabound/duality';
import type { TaskDto, TaskStatus } from '@atlas/shared';

import { STATUS_LABELS } from '../../lib/labels.ts';

interface BoardBucketProps {
  status: TaskStatus;
  /** Tasks already scoped to this status, sorted by score descending. */
  tasks: TaskDto[];
  onViewAll: (status: TaskStatus) => void;
}

/** A glanceable summary of one board column: count and score range. */
export function BoardBucket({ status, tasks, onViewAll }: BoardBucketProps) {
  const count = tasks.length;
  // Tasks arrive sorted by score descending, so the ends are the extremes.
  const max = count > 0 ? tasks[0]!.score : null;
  const min = count > 0 ? tasks[count - 1]!.score : null;

  return (
    <Card>
      <CardBody>
        <Stack gap={3}>
          <Inline gap={2} align="center" justify="between">
            <Text weight="bold">{STATUS_LABELS[status]}</Text>
            <Badge variant="outline">{count}</Badge>
          </Inline>

          <StatGroup>
            <Stat label="Min score" value={min ?? '—'} />
            <Stat label="Max score" value={max ?? '—'} />
          </StatGroup>

          <Button variant="solid" disabled={count === 0} onClick={() => onViewAll(status)}>
            View all
          </Button>
        </Stack>
      </CardBody>
    </Card>
  );
}
