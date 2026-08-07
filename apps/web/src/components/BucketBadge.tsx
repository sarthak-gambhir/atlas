import { Badge, Icon, type ControlSize } from '@astrabound/duality';
import type { PriorityBucket } from '@atlas/shared';

import { PRIORITY_ICONS } from '../lib/icons.ts';
import { BUCKET_BADGE_VARIANT, BUCKET_LABELS } from '../lib/labels.ts';

interface BucketBadgeProps {
  bucket: PriorityBucket;
  size?: ControlSize;
}

/** Consistent priority-bucket chip: humanized label with a weight that tracks priority. */
export function BucketBadge({ bucket, size = 'md' }: BucketBadgeProps) {
  return (
    <Badge
      className={`atlas-bucket-badge bucket-badge-${bucket}`}
      variant={BUCKET_BADGE_VARIANT[bucket]}
      size={size}
    >
      <Icon icon={PRIORITY_ICONS[bucket]} />
      {BUCKET_LABELS[bucket]}
    </Badge>
  );
}
