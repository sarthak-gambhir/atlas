import { Badge, type ControlSize } from '@astrabound/duality';
import type { PriorityBucket } from '@atlas/shared';

import { BUCKET_BADGE_VARIANT, BUCKET_LABELS } from '../lib/labels.ts';

interface BucketBadgeProps {
  bucket: PriorityBucket;
  size?: ControlSize;
}

/** Consistent priority-bucket chip: humanized label with a weight that tracks priority. */
export function BucketBadge({ bucket, size = 'sm' }: BucketBadgeProps) {
  return (
    <Badge className={`bucket-badge-${bucket}`} variant={BUCKET_BADGE_VARIANT[bucket]} size={size}>
      {BUCKET_LABELS[bucket]}
    </Badge>
  );
}
