import { Badge } from '@astrabound/duality';
import type { PriorityBucket } from '@atlas/shared';

import { BUCKET_BADGE_VARIANT, BUCKET_LABELS } from '../lib/labels.ts';

interface BucketBadgeProps {
  bucket: PriorityBucket;
}

/** Consistent priority-bucket chip: humanized label with a weight that tracks priority. */
export function BucketBadge({ bucket }: BucketBadgeProps) {
  return (
    <Badge variant={BUCKET_BADGE_VARIANT[bucket]} dot>
      {BUCKET_LABELS[bucket]}
    </Badge>
  );
}
