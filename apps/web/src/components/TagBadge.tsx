import { Badge, type ControlSize } from '@astrabound/duality';

interface TagBadgeProps {
  tag: string;
  size?: ControlSize;
}

/** A task or project tag, always shown with a leading # so it reads as a label. */
export function TagBadge({ tag, size = 'sm' }: TagBadgeProps) {
  return (
    <Badge variant="outline" size={size}>
      #{tag}
    </Badge>
  );
}
