import {
  Button,
  Card,
  CardBody,
  Icon,
  Inline,
  Stack,
  Stat,
  StatGroup,
  Text,
} from '@astrabound/duality';
import type { TaskDto, TaskStatus } from '@atlas/shared';

import { ICON_SIZES, STATUS_ICONS } from '../../lib/icons.ts';
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
  // Tasks arrive sorted by score descending, so the first is the highest.
  const max = count > 0 ? tasks[0]!.score : null;

  return (
    <Card>
      <CardBody>
        <Stack gap={3}>
          <Inline gap={2} align="center" wrap={false}>
            <Icon size={ICON_SIZES.lg} icon={STATUS_ICONS[status]} />
            <Text weight="bold">{STATUS_LABELS[status]}</Text>
          </Inline>

          <StatGroup>
            <Stat label="Tasks" value={count} />
            <Stat label="Max score" value={max ?? '—'} />
          </StatGroup>

          <Button
            className="atlas-button"
            variant="solid"
            size="md"
            disabled={count === 0}
            onClick={() => onViewAll(status)}
          >
            View all
          </Button>
        </Stack>
      </CardBody>
    </Card>
  );
}
