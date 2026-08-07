import { Button, EmptyState, Icon } from '@astrabound/duality';
import { useNavigate } from 'react-router';

import { IconLabel } from '../components/IconLabel.tsx';
import { ACTION_ICONS } from '../lib/icons.ts';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={<Icon icon={ACTION_ICONS.warning} size={64} />}
      title="Nothing here"
      description="That page does not exist."
      action={
        <Button className="atlas-button" size="md" onClick={() => void navigate('/')}>
          <IconLabel icon={ACTION_ICONS.back}>Back to tasks</IconLabel>
        </Button>
      }
    />
  );
}
