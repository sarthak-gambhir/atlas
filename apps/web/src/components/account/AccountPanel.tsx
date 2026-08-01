import {
  Avatar,
  Badge,
  Button,
  Divider,
  FormField,
  Heading,
  Inline,
  Input,
  Stack,
  Text,
  useToast,
} from '@astrabound/duality';
import { useState, type FormEvent } from 'react';

import { useChangePassword } from '../../lib/admin.ts';
import { useSession, useSignOutOtherDevices } from '../../lib/session.ts';
import { EditProfileModal } from './EditProfileModal.tsx';

export function AccountPanel() {
  return (
    <Stack gap={5}>
      <IdentitySection />
      <Divider />
      <ChangePasswordSection />
      <Divider />
      <SessionsSection />
    </Stack>
  );
}

function IdentitySection() {
  const { data: user } = useSession();
  const [editing, setEditing] = useState(false);
  // Bumping the key remounts the modal so it reopens with the live values.
  const [editKey, setEditKey] = useState(0);

  const openEditor = () => {
    setEditKey((key) => key + 1);
    setEditing(true);
  };

  return (
    <Stack gap={3}>
      <Stack gap={1}>
        <Heading level={3} visualLevel={5}>
          Profile
        </Heading>
        <Text size="sm">How you appear across Atlas.</Text>
      </Stack>

      <Inline gap={3} align="center" justify="between">
        <Inline gap={3} align="center">
          <Avatar name={user?.displayName} size="lg" />
          <Stack gap={1}>
            <Inline gap={2} align="center">
              <Text weight="bold">{user?.displayName}</Text>
              {user ? (
                <Badge variant={user.role === 'admin' ? 'solid' : 'outline'}>{user.role}</Badge>
              ) : null}
            </Inline>
            <Text size="sm">@{user?.username}</Text>
          </Stack>
        </Inline>

        <Button variant="inverse" size="sm" onClick={openEditor}>
          Edit profile
        </Button>
      </Inline>

      {user ? (
        <EditProfileModal
          key={editKey}
          user={user}
          isOpen={editing}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </Stack>
  );
}

function ChangePasswordSection() {
  const change = useChangePassword();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const mismatch = confirmation !== '' && confirmation !== newPassword;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast({ title: 'Password changed', description: 'Other devices were signed out.' });
          setCurrentPassword('');
          setNewPassword('');
          setConfirmation('');
        },
        onError: (cause) =>
          toast({ title: 'Could not change password', description: cause.message, tone: 'error' }),
      },
    );
  };

  return (
    <Stack gap={3}>
      <Stack gap={1}>
        <Heading level={3} visualLevel={5}>
          Change password
        </Heading>
        <Text size="sm">Changing your password signs out your other devices.</Text>
      </Stack>

      <form onSubmit={submit}>
        <Stack gap={3} style={{ maxWidth: 420 }}>
          <FormField label="Current password" required>
            <Input
              type="password"
              value={currentPassword}
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </FormField>

          <FormField label="New password" hint="At least 8 characters" required>
            <Input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </FormField>

          <FormField
            label="Confirm new password"
            error={mismatch ? 'The two passwords do not match.' : undefined}
            required
          >
            <Input
              type="password"
              value={confirmation}
              autoComplete="new-password"
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </FormField>

          <Inline justify="end">
            <Button
              type="submit"
              variant="solid"
              disabled={
                change.isPending ||
                mismatch ||
                currentPassword === '' ||
                newPassword.length < 8 ||
                confirmation === ''
              }
            >
              {change.isPending ? 'Changing...' : 'Change password'}
            </Button>
          </Inline>
        </Stack>
      </form>
    </Stack>
  );
}

function SessionsSection() {
  const signOutOthers = useSignOutOtherDevices();
  const { toast } = useToast();

  const run = () => {
    signOutOthers.mutate(undefined, {
      onSuccess: () => toast({ title: 'Other devices signed out' }),
      onError: (cause) =>
        toast({ title: 'Could not sign out other devices', description: cause.message, tone: 'error' }),
    });
  };

  return (
    <Stack gap={3}>
      <Stack gap={1}>
        <Heading level={3} visualLevel={5}>
          Sessions
        </Heading>
        <Text size="sm">
          Sign out everywhere except this device. Useful if you signed in on a shared or lost
          machine.
        </Text>
      </Stack>

      <Inline>
        <Button variant="inverse" disabled={signOutOthers.isPending} onClick={run}>
          {signOutOthers.isPending ? 'Signing out...' : 'Sign out other devices'}
        </Button>
      </Inline>
    </Stack>
  );
}
