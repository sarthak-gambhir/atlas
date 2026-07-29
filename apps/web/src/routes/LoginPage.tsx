import {
  Alert,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  FormField,
  Heading,
  Input,
  Stack,
  Text,
} from '@astrabound/duality';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

import { ApiError } from '../lib/api.ts';
import { useLogin, useSession } from '../lib/session.ts';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { data: user, isPending } = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const destination = (location.state as LocationState | null)?.from ?? '/';

  if (!isPending && user) return <Navigate to={destination} replace />;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate(
      { username, password },
      { onSuccess: () => void navigate(destination, { replace: true }) },
    );
  };

  const message =
    login.error instanceof ApiError ? login.error.message : login.error ? 'Sign-in failed.' : null;

  return (
    <Box paddingX={4} style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Container size="sm" style={{ width: '100%' }}>
        <Stack gap={5}>
          <Heading level={1}>Atlas</Heading>

          <Card as="form" onSubmit={handleSubmit}>
            <CardHeader>
              <Heading level={2} visualLevel={4}>
                Sign in
              </Heading>
            </CardHeader>
            <CardBody>
              <Stack gap={4}>
                {message ? (
                  <Alert tone="error" role="alert">
                    {message}
                  </Alert>
                ) : null}

                <FormField label="Username" required>
                  <Input
                    name="username"
                    value={username}
                    autoComplete="username"
                    autoFocus
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </FormField>

                <FormField label="Password" required>
                  <Input
                    name="password"
                    type="password"
                    value={password}
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </FormField>

                <Button type="submit" variant="solid" disabled={login.isPending}>
                  {login.isPending ? 'Signing in...' : 'Sign in'}
                </Button>

                <Text size="sm">
                  Accounts are created by an admin with the create-user command.
                </Text>
              </Stack>
            </CardBody>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
