import { Button, Icon, Inline, Text } from '@astrabound/duality';
import type { IconType } from 'react-icons';
import type { ReactNode } from 'react';

import { ACTION_ICONS } from '../lib/icons.ts';
import { useIsMobile } from '../lib/useIsMobile.ts';

interface QuickFilterChipProps {
  /** The chip's subject glyph, e.g. a star for favorites. */
  icon: IconType;
  active: boolean;
  onToggle: () => void;
  children: ReactNode;
  'aria-label'?: string;
}

/**
 * An always-visible header toggle. Pressed chips invert (solid) and gain a
 * trailing check, and expose `aria-pressed`, so the on/off state never rests on
 * color alone.
 */
export function QuickFilterChip({
  icon,
  active,
  onToggle,
  children,
  'aria-label': ariaLabel,
}: QuickFilterChipProps) {
  return (
    <Button
      className="atlas-button atlas-chip"
      size="sm"
      variant={active ? 'solid' : 'inverse'}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onToggle}
    >
      <Inline gap={2} align="center" wrap={false}>
        <Icon icon={icon} />
        {children}
        {active ? <Icon icon={ACTION_ICONS.confirm} /> : null}
      </Inline>
    </Button>
  );
}

/**
 * Labels a row of QuickFilterChips as a group so the chips read as filters
 * rather than loose buttons (and screen readers announce them together).
 */
export function QuickFilterBar({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  return (
    <div role="group" aria-label="Quick filters">
      <Inline gap={2} align="center" wrap>
        <Inline gap={1} align="center" wrap={false}>
          <Icon icon={ACTION_ICONS.filter} />
          {!isMobile && <Text size="sm">Quick filters</Text>}
        </Inline>
        {children}
      </Inline>
    </div>
  );
}
