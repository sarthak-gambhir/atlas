import {
  Button,
  ConfirmDialog,
  Heading,
  Icon,
  Inline,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  Text,
  useToast,
} from '@astrabound/duality';
import type { UpdateUserInput, UserSummaryDto } from '@atlas/shared';
import { useState } from 'react';

import { generateTempPassword, useDeleteUser, useUpdateUser } from '../../lib/admin.ts';
import { ACTION_ICONS } from '../../lib/icons.ts';
import { IconLabel } from '../IconLabel.tsx';

interface PersonRowActionsProps {
  person: UserSummaryDto;
  isSelf: boolean;
  isLastAdmin: boolean;
  onEdit: () => void;
}

type PendingConfirm = 'disable' | 'demote' | 'delete' | null;

export function PersonRowActions({ person, isSelf, isLastAdmin, onEdit }: PersonRowActionsProps) {
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const { toast } = useToast();

  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const patch = (changes: Omit<UpdateUserInput, 'password'>, successTitle: string) =>
    updateUser.mutate(
      { id: person.id, ...changes },
      {
        onSuccess: () => {
          toast({ title: successTitle });
          setConfirm(null);
        },
        onError: (cause) =>
          toast({ title: 'Could not update user', description: cause.message, tone: 'error' }),
      },
    );

  const resetPassword = () => {
    const password = generateTempPassword();
    updateUser.mutate(
      { id: person.id, password },
      {
        onSuccess: () => setTempPassword(password),
        onError: (cause) =>
          toast({ title: 'Could not reset password', description: cause.message, tone: 'error' }),
      },
    );
  };

  const remove = () => {
    deleteUser.mutate(person.id, {
      onSuccess: () => {
        toast({ title: `${person.displayName} deleted` });
        setConfirm(null);
      },
      onError: (cause) =>
        toast({ title: 'Could not delete user', description: cause.message, tone: 'error' }),
    });
  };

  const copyPassword = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast({ title: 'Password copied' });
    } catch {
      toast({ title: 'Copy failed', description: 'Select and copy it manually.', tone: 'error' });
    }
  };

  const disableReason = isSelf
    ? 'You cannot disable your own account.'
    : isLastAdmin
      ? 'Atlas needs at least one active admin.'
      : undefined;

  return (
    <>
      <Menu
        placement="bottom-end"
        aria-label={`Actions for ${person.displayName}`}
        trigger={
          <Button
            variant="inverse"
            size="sm"
            aria-label={`Actions for ${person.displayName}`}
            className="atlas-action-menu-button"
          >
            <Icon icon={ACTION_ICONS.more} />
          </Button>
        }
      >
        <MenuItem onSelect={onEdit}>
          <IconLabel icon={ACTION_ICONS.edit}>Edit</IconLabel>
        </MenuItem>

        {person.role === 'admin' ? (
          <MenuItem
            disabled={isLastAdmin}
            title={isLastAdmin ? 'Atlas needs at least one active admin.' : undefined}
            onSelect={() => setConfirm('demote')}
          >
            <IconLabel icon={ACTION_ICONS.role}>Make member</IconLabel>
          </MenuItem>
        ) : (
          <MenuItem onSelect={() => patch({ role: 'admin' }, `${person.displayName} is now an admin`)}>
            <IconLabel icon={ACTION_ICONS.role}>Make admin</IconLabel>
          </MenuItem>
        )}

        <MenuItem onSelect={resetPassword}>
          <IconLabel icon={ACTION_ICONS.resetPassword}>Reset password</IconLabel>
        </MenuItem>

        <MenuSeparator />

        {person.disabled ? (
          <>
            <MenuItem
              onSelect={() => patch({ disabled: false }, `${person.displayName} re-enabled`)}
            >
              <IconLabel icon={ACTION_ICONS.enable}>Enable</IconLabel>
            </MenuItem>
            <MenuItem onSelect={() => setConfirm('delete')}>
              <IconLabel icon={ACTION_ICONS.delete}>Delete</IconLabel>
            </MenuItem>
          </>
        ) : (
          <MenuItem
            disabled={isSelf || isLastAdmin}
            title={disableReason}
            onSelect={() => setConfirm('disable')}
          >
            <IconLabel icon={ACTION_ICONS.disable}>Disable</IconLabel>
          </MenuItem>
        )}
      </Menu>

      <ConfirmDialog
        isOpen={confirm === 'disable'}
        closeOnBackdrop={false}
        tone="danger"
        title={`Disable ${person.displayName}?`}
        description="They will be signed out of every device and cannot sign in until re-enabled."
        confirmLabel="Disable"
        isLoading={updateUser.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => patch({ disabled: true }, `${person.displayName} disabled`)}
      />

      <ConfirmDialog
        isOpen={confirm === 'demote'}
        closeOnBackdrop={false}
        tone="danger"
        title={`Make ${person.displayName} a member?`}
        description="They will lose admin access, including managing people and scoring."
        confirmLabel="Make member"
        isLoading={updateUser.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => patch({ role: 'member' }, `${person.displayName} is now a member`)}
      />

      <ConfirmDialog
        isOpen={confirm === 'delete'}
        closeOnBackdrop={false}
        tone="danger"
        title={`Delete ${person.displayName}?`}
        description="This permanently removes the account. Any tasks assigned to them become unassigned. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteUser.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
      />

      <Modal
        isOpen={tempPassword !== null}
        onClose={() => setTempPassword(null)}
        size="sm"
        showCloseButton
        closeOnBackdrop={false}
        aria-label="Temporary password"
      >
        <ModalHeader>
          <Heading level={2} visualLevel={4}>
            Temporary password
          </Heading>
        </ModalHeader>
        <ModalBody>
          <Stack gap={3}>
            <Text size="sm">
              {person.displayName} has been signed out. Share this password with them; they can
              change it after signing in.
            </Text>
            <Inline gap={2} align="center">
              <Input readOnly value={tempPassword ?? ''} aria-label="Temporary password" />
              <Button type="button" variant="ghost" size="sm" onClick={() => void copyPassword()}>
                <IconLabel icon={ACTION_ICONS.copy}>Copy</IconLabel>
              </Button>
            </Inline>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Inline gap={2} justify="end">
            <Button type="button" variant="solid" onClick={() => setTempPassword(null)}>
              Done
            </Button>
          </Inline>
        </ModalFooter>
      </Modal>
    </>
  );
}
