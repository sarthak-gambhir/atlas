import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Heading,
  Inline,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  Text,
  useToast,
} from '@astrabound/duality';
import type { ProjectDto } from '@atlas/shared';
import { useMemo, useState } from 'react';

import { useAddProjectMember, useRemoveProjectMember, useUsers } from '../../lib/organization.ts';
import { useSession } from '../../lib/session.ts';

interface ManageMembersModalProps {
  project: ProjectDto;
  /** Owner-or-admin may change who belongs to the project. */
  canManage: boolean;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Membership editor: search and tick users to add or remove, then Save applies
 * the whole diff after a confirmation. Roles and ownership stay on the project
 * detail page's Members tab; new members join as editors (the server default).
 */
export function ManageMembersModal({ project, canManage, isOpen, onClose }: ManageMembersModalProps) {
  const { data: users } = useUsers();
  const { data: session } = useSession();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(project.memberIds));
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const isMember = (id: string) => project.memberIds.includes(id);

  // Everyone active, plus current members even if disabled (so they can still be
  // removed). Members sort first, then alphabetically by display name.
  const candidates = useMemo(() => {
    const list = (users ?? []).filter((user) => !user.disabled || isMember(user.id));
    return [...list].sort((a, b) => {
      const am = isMember(a.id);
      const bm = isMember(b.id);
      if (am !== bm) return am ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
    // isMember reads project.memberIds; users drives the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, project.memberIds]);

  const query = search.trim().toLowerCase();
  const visible =
    query === ''
      ? candidates
      : candidates.filter(
          (user) =>
            user.displayName.toLowerCase().includes(query) ||
            user.username.toLowerCase().includes(query),
        );

  const toAdd = [...selected].filter((id) => !project.memberIds.includes(id));
  const toRemove = project.memberIds.filter((id) => id !== project.ownerId && !selected.has(id));
  const hasChanges = toAdd.length > 0 || toRemove.length > 0;

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const apply = async () => {
    setPending(true);
    const results = await Promise.allSettled([
      ...toAdd.map((userId) => addMember.mutateAsync({ id: project.id, userId })),
      ...toRemove.map((userId) => removeMember.mutateAsync({ id: project.id, userId })),
    ]);
    setPending(false);
    const failed = results.filter((result) => result.status === 'rejected').length;
    const succeeded = results.length - failed;
    const parts: string[] = [];
    if (toAdd.length > 0) parts.push(`${toAdd.length} added`);
    if (toRemove.length > 0) parts.push(`${toRemove.length} removed`);
    if (failed > 0) parts.push(`${failed} failed`);
    toast({
      title: parts.length > 0 ? parts.join(', ') : 'No changes',
      tone: failed > 0 ? 'error' : 'success',
    });
    setConfirming(false);
    if (failed === 0 || succeeded > 0) onClose();
  };

  const changeSummary = [
    toAdd.length > 0 ? `add ${toAdd.length}` : null,
    toRemove.length > 0 ? `remove ${toRemove.length}` : null,
  ]
    .filter(Boolean)
    .join(' and ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton
      closeOnBackdrop={false}
      aria-label={`Members of ${project.name}`}
    >
      <ModalHeader>
        <Heading level={2} visualLevel={4}>
          Manage members
        </Heading>
      </ModalHeader>

      <ModalBody>
        <Stack gap={3}>
          <Input
            value={search}
            placeholder="Search users"
            clearable
            aria-label="Search users"
            onClear={() => setSearch('')}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div style={{ maxBlockSize: '22rem', overflowY: 'auto' }}>
            {visible.length === 0 ? (
              <Text size="sm">No users match.</Text>
            ) : (
              <Stack gap={2}>
                {visible.map((user) => {
                  const owner = user.id === project.ownerId;
                  return (
                    <Inline key={user.id} gap={3} align="center" wrap={false}>
                      <Checkbox
                        aria-label={`${selected.has(user.id) ? 'Remove' : 'Add'} ${user.displayName}`}
                        checked={selected.has(user.id)}
                        disabled={!canManage || owner}
                        onChange={(event) => toggle(user.id, event.target.checked)}
                      />
                      <Avatar name={user.displayName} size="sm" />
                      <Stack gap={0}>
                        <Inline gap={2} align="center">
                          <Text>{user.displayName}</Text>
                          {owner ? (
                            <Badge variant="outline" size="sm">
                              Owner
                            </Badge>
                          ) : null}
                          {user.id === session?.id ? (
                            <Badge variant="outline" size="sm">
                              You
                            </Badge>
                          ) : null}
                          {user.disabled ? (
                            <Badge variant="outline" size="sm">
                              Disabled
                            </Badge>
                          ) : null}
                        </Inline>
                        <Text size="sm">@{user.username}</Text>
                      </Stack>
                    </Inline>
                  );
                })}
              </Stack>
            )}
          </div>
        </Stack>
      </ModalBody>

      <ModalFooter>
        <Inline gap={2} justify="end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="solid"
            disabled={!canManage || !hasChanges}
            onClick={() => setConfirming(true)}
          >
            Save
          </Button>
        </Inline>
      </ModalFooter>

      <ConfirmDialog
        isOpen={confirming}
        closeOnBackdrop={false}
        title="Save member changes?"
        description={`This will ${changeSummary} ${
          toAdd.length + toRemove.length === 1 ? 'member' : 'members'
        }. Removed members lose access, and any tasks assigned to them here become unassigned.`}
        confirmLabel="Save"
        isLoading={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void apply()}
      />
    </Modal>
  );
}
