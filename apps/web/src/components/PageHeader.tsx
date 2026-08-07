import { Badge, Heading, Icon, Inline, Stack, Text } from '@astrabound/duality';
import type { IconType } from 'react-icons';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** Glyph shown before the title; usually the page's nav icon (see PAGE_ICONS). */
  icon?: IconType;
  /** Optional count chip beside the title, e.g. the number of tasks. */
  count?: number;
  description?: string;
  /** Right-aligned controls, e.g. a primary action button. */
  actions?: ReactNode;
}

/** One title/description/action block, so every route lines up the same way. */
export function PageHeader({ title, icon, count, description, actions }: PageHeaderProps) {
  return (
    <Stack gap={1}>
      <Inline gap={3} align="center" justify="between" wrap>
        <Inline gap={2} align="center">
          {icon ? <Icon icon={icon} size="lg" /> : null}
          <Heading level={1} visualLevel={3}>
            {title}
          </Heading>
          {count != null ? <Badge variant="outline">{count}</Badge> : null}
        </Inline>

        {actions ? (
          <Inline gap={2} align="center">
            {actions}
          </Inline>
        ) : null}
      </Inline>

      {description ? <Text size="sm">{description}</Text> : null}
    </Stack>
  );
}
