import { Icon, Inline } from '@astrabound/duality';
import type { IconType } from 'react-icons';
import type { ReactNode } from 'react';

interface IconLabelProps {
  icon: IconType;
  children: ReactNode;
}

/**
 * An icon paired with its text label. Duality's Button and MenuItem take no icon
 * prop, so both compose their glyph as a child; this keeps that spacing uniform.
 * The icon stays decorative because the label beside it already names the action.
 */
export function IconLabel({ icon, children }: IconLabelProps) {
  return (
    <Inline gap={2} align="center" wrap={false}>
      <Icon icon={icon} />
      {children}
    </Inline>
  );
}
