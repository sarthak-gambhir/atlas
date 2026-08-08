import { Spinner, Stack } from '@astrabound/duality';

import { AppShell } from '../components/AppShell.tsx';
import { useSession } from '../lib/session.ts';
import { AboutPage } from './AboutPage.tsx';

/**
 * The public `/` route. Signed out, it shows the standalone About landing;
 * signed in, it renders About inside the app shell so the nav stays available.
 */
export function HomeRoute() {
  const { data: user, isPending } = useSession();

  if (isPending) {
    return (
      <Stack align="center" justify="center" gap={3} style={{ minHeight: '100vh' }}>
        <Spinner label="Loading" />
      </Stack>
    );
  }

  if (!user) {
    return <AboutPage />;
  }

  return (
    <AppShell>
      <AboutPage inShell />
    </AppShell>
  );
}
