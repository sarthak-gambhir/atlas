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
import { ACTION_ICONS } from '../../lib/icons.ts';
import {
  isDemoAccount,
  useLogout,
  useSession,
  useSignOutOtherDevices,
} from '../../lib/session.ts';
import { IconLabel } from '../IconLabel.tsx';
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
  const demo = isDemoAccount(user);
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
        <Text size="sm">
          {demo ? 'The shared demo profile is read-only.' : 'How you appear across Atlas.'}
        </Text>
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

        <Button
          className="atlas-button"
          variant="inverse"
          size="md"
          disabled={demo}
          onClick={openEditor}
        >
          <IconLabel icon={ACTION_ICONS.edit}>Edit profile</IconLabel>
        </Button>
      </Inline>

      {user && !demo ? (
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
  const { data: user } = useSession();
  const change = useChangePassword();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const mismatch = confirmation !== '' && confirmation !== newPassword;

  // The shared demo login's password is locked server-side; don't offer a form
  // that can only fail.
  if (isDemoAccount(user)) {
    return (
      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={3} visualLevel={5}>
            Change password
          </Heading>
          <Text size="sm">
            This is the shared demo account, so its password is locked. Create your own account to
            manage a password.
          </Text>
        </Stack>
      </Stack>
    );
  }

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
              className="atlas-button"
              type="submit"
              variant="solid"
              disabled={
                change.isPending ||
                mismatch ||
                currentPassword === '' ||
                newPassword.length < 8 ||
                confirmation === ''
              }
              size="md"
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
  const { data: user } = useSession();
  const signOutOthers = useSignOutOtherDevices();
  const logout = useLogout();
  const { toast } = useToast();

  const run = () => {
    signOutOthers.mutate(undefined, {
      onSuccess: () => toast({ title: 'Other devices signed out' }),
      onError: (cause) =>
        toast({
          title: 'Could not sign out other devices',
          description: cause.message,
          tone: 'error',
        }),
    });
  };

  // The demo login is shared, so signing out "other devices" would sign out
  // other visitors. Offer a plain sign-out that ends only this session instead.
  if (isDemoAccount(user)) {
    return (
      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={3} visualLevel={5}>
            Session
          </Heading>
          <Text size="sm">
            This is the shared demo account. Sign out to end your session; other visitors stay
            signed in.
          </Text>
        </Stack>

        <Inline>
          <Button
            className="atlas-button"
            variant="inverse"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            size="md"
          >
            <IconLabel icon={ACTION_ICONS.signOut}>
              {logout.isPending ? 'Signing out...' : 'Sign out'}
            </IconLabel>
          </Button>
        </Inline>
      </Stack>
    );
  }

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
        <Button
          className="atlas-button"
          variant="inverse"
          disabled={signOutOthers.isPending}
          onClick={run}
          size="md"
        >
          <IconLabel icon={ACTION_ICONS.signOut}>
            {signOutOthers.isPending ? 'Signing out...' : 'Sign out other devices'}
          </IconLabel>
        </Button>
      </Inline>
    </Stack>
  );
}
