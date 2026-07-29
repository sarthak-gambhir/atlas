import { Badge, Heading, Inline, Stack, Text } from '@astrabound/duality';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** Optional count chip beside the title, e.g. the number of tasks. */
  count?: number;
  description?: string;
  /** Right-aligned controls, e.g. a primary action button. */
  actions?: ReactNode;
}

/** One title/description/action block, so every route lines up the same way. */
export function PageHeader({ title, count, description, actions }: PageHeaderProps) {
  return (
    <Stack gap={1}>
      <Inline gap={3} align="center" justify="between" wrap>
        <Inline gap={2} align="center">
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
