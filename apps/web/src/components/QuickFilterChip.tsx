import { Button, Icon, Inline, Stack, Text } from '@astrabound/duality';
import type { IconType } from 'react-icons';
import type { ReactNode } from 'react';

import { ACTION_ICONS } from '../lib/icons.ts';

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
 * Groups a set of QuickFilterChips under a section label so they read as filters
 * rather than loose buttons. The label sits above the chip row (screen readers
 * announce them together via the group), which keeps the chips from wrapping
 * around the label in a narrow popover.
 */
export function QuickFilterBar({ children }: { children: ReactNode }) {
  return (
    <Stack gap={2} role="group" aria-label="Quick filters">
      <Inline gap={1} align="center" wrap={false}>
        <Icon icon={ACTION_ICONS.filter} />
        <Text size="sm">Quick filters</Text>
      </Inline>
      <Inline gap={2} align="center" wrap>
        {children}
      </Inline>
    </Stack>
  );
}
