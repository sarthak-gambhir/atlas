import { Badge, Icon, type ControlSize } from '@astrabound/duality';
import type { TaskStatus } from '@atlas/shared';

import { STATUS_ICONS } from '../lib/icons.ts';
import { STATUS_LABELS } from '../lib/labels.ts';

interface StatusBadgeProps {
  status: TaskStatus;
  size?: ControlSize;
}

/** Where a task sits in the flow: the stage glyph beside its label. */
export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  return (
    <Badge variant="outline" size={size}>
      <Icon icon={STATUS_ICONS[status]} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
