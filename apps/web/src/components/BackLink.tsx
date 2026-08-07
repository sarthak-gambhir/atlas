import { Button, Icon, Inline, Text } from '@astrabound/duality';
import { Link } from 'react-router';

import { type BackTarget, useBackTarget } from '../lib/backNav.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { IconLabel } from './IconLabel.tsx';

interface BackLinkProps {
  /** Where to go when no origin was recorded (deep link / refresh). */
  fallback: BackTarget;
  /**
   * `link` (default) is the compact top-of-page control showing just the origin
   * label; `button` is the solid empty-state action reading "Back to {label}".
   */
  variant?: 'link' | 'button';
}

/**
 * A "Back" control that returns to wherever the user came from (see useBackTarget),
 * falling back to a page-appropriate default. Used by the detail and not-found pages.
 */
export function BackLink({ fallback, variant = 'link' }: BackLinkProps) {
  const target = useBackTarget(fallback);

  if (variant === 'button') {
    return (
      <Link to={target.to} className="atlas-card-link">
        <Button className="atlas-button" size="md" variant="solid">
          <IconLabel icon={ACTION_ICONS.back}>Back to {target.label}</IconLabel>
        </Button>
      </Link>
    );
  }

  return (
    <Link to={target.to} className="atlas-card-link">
      <Inline gap={1} align="center">
        <Icon icon={ACTION_ICONS.back} />
        <Text size="sm">{target.label}</Text>
      </Inline>
    </Link>
  );
}
