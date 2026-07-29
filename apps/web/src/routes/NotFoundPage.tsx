import { Button, EmptyState } from '@astrabound/duality';
import { useNavigate } from 'react-router';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <EmptyState
      title="Nothing here"
      description="That page does not exist."
      action={<Button onClick={() => void navigate('/')}>Back to backlog</Button>}
    />
  );
}
