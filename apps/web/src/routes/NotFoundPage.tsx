import { EmptyState, Icon } from '@astrabound/duality';

import { BackLink } from '../components/BackLink.tsx';
import { ACTION_ICONS } from '../lib/icons.ts';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Icon icon={ACTION_ICONS.warning} size={64} />}
      title="Nothing here"
      description="That page does not exist."
      action={<BackLink fallback={{ label: 'Tasks', to: '/' }} variant="button" />}
    />
  );
}
