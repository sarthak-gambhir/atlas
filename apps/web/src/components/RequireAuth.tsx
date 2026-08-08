import { Heading, Spinner, Stack } from '@astrabound/duality';
import { Navigate, Outlet, useLocation } from 'react-router';

import { useSession } from '../lib/session.ts';

export function RequireAuth() {
  const { data: user, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <Stack align="center" justify="center" gap={3} style={{ minHeight: '100vh' }}>
        <Spinner size="lg" label="Loading" />
        <Heading level={2} visualLevel={4}>
          Loading...
        </Heading>
      </Stack>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
