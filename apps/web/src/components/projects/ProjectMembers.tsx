import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Inline,
  Menu,
  MenuItem,
  Select,
  Stack,
  Text,
  useToast,
  type DataTableColumn,
} from '@astrabound/duality';
import type { ProjectDto, ProjectMemberRole, UserSummaryDto } from '@atlas/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { RiMore2Fill } from 'react-icons/ri';

import {
  projectRoleFor,
  useAddProjectMember,
  useRemoveProjectMember,
  useTransferProjectOwnership,
  useUpdateMemberRole,
  useUsers,
} from '../../lib/organization.ts';
import { useSession } from '../../lib/session.ts';
import { useIsMobile } from '../../lib/useIsMobile.ts';

const ROLE_LABELS: Record<'owner' | ProjectMemberRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

interface ProjectMembersProps {
  project: ProjectDto;
  /** Owner-or-admin may add, remove and hand over ownership. */
  canManage: boolean;
}

/** Who can see and work in the project. The owner is always a member. */
export function ProjectMembers({ project, canManage }: ProjectMembersProps) {
  const { data: users } = useUsers();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const transferOwnership = useTransferProjectOwnership();
  const updateRole = useUpdateMemberRole();
  const { toast } = useToast();

  const [removing, setRemoving] = useState<UserSummaryDto | null>(null);
  const [transferring, setTransferring] = useState<UserSummaryDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);

  const members = useMemo(() => {
    const byId = new Map((users ?? []).map((user) => [user.id, user]));
    return project.memberIds
      .map((id) => byId.get(id))
      .filter((user): user is UserSummaryDto => user != null)
      .sort((a, b) => {
        if (a.id === project.ownerId) return -1;
        if (b.id === project.ownerId) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [users, project.memberIds, project.ownerId]);

  const candidates = (users ?? []).filter(
    (user) => !user.disabled && !project.memberIds.includes(user.id),
  );

  const add = (userId: string) => {
    if (userId === '') return;
    addMember.mutate(
      { id: project.id, userId },
      {
        onSuccess: () => toast({ title: 'Member added', tone: 'success' }),
        onError: (cause) =>
          toast({ title: 'Could not add member', description: cause.message, tone: 'error' }),
      },
    );
  };

  const confirmRemove = () => {
    if (!removing) return;
    removeMember.mutate(
      { id: project.id, userId: removing.id },
      {
        onSuccess: () => {
          toast({ title: 'Member removed', tone: 'success' });
          setRemoving(null);
        },
        onError: (cause) =>
          toast({ title: 'Could not remove member', description: cause.message, tone: 'error' }),
      },
    );
  };

  // The owner cannot be removed, so drop it from any bulk selection.
  const removableSelected = selectedIds.filter((id) => id !== project.ownerId);

  const confirmBulkRemove = async () => {
    setBulkPending(true);
    const results = await Promise.allSettled(
      removableSelected.map((userId) => removeMember.mutateAsync({ id: project.id, userId })),
    );
    setBulkPending(false);
    const removed = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - removed;
    const skippedOwner = selectedIds.length - removableSelected.length;
    const parts = [`${removed} removed`];
    if (skippedOwner > 0) parts.push(`${skippedOwner} skipped (owner)`);
    if (failed > 0) parts.push(`${failed} failed`);
    toast({ title: parts.join(', '), tone: failed > 0 ? 'error' : 'success' });
    setSelectedIds([]);
    setBulkRemoving(false);
  };

  const changeRole = (member: UserSummaryDto, role: ProjectMemberRole) => {
    updateRole.mutate(
      { id: project.id, userId: member.id, role },
      {
        onSuccess: () =>
          toast({
            title: `${member.displayName} is now a ${ROLE_LABELS[role].toLowerCase()}`,
            tone: 'success',
          }),
        onError: (cause) =>
          toast({ title: 'Could not change role', description: cause.message, tone: 'error' }),
      },
    );
  };

  const confirmTransfer = () => {
    if (!transferring) return;
    transferOwnership.mutate(
      { id: project.id, userId: transferring.id },
      {
        onSuccess: () => {
          toast({ title: `${transferring.displayName} is now the owner`, tone: 'success' });
          setTransferring(null);
        },
        onError: (cause) =>
          toast({
            title: 'Could not transfer ownership',
            description: cause.message,
            tone: 'error',
          }),
      },
    );
  };

  // The per-member action menu, shared by the desktop table and mobile cards.
  const renderMemberActions = (member: UserSummaryDto): ReactNode => {
    if (!canManage || member.id === project.ownerId) return null;
    const role = projectRoleFor(project, member.id) ?? 'editor';
    return (
      <Menu
        placement="bottom-end"
        trigger={
          <Button
            variant="inverse"
            size="sm"
            aria-label={`Actions for ${member.displayName}`}
            className="atlas-action-menu-button"
          >
            <RiMore2Fill aria-hidden />
          </Button>
        }
      >
        {role === 'viewer' ? (
          <MenuItem onSelect={() => changeRole(member, 'editor')}>Make editor</MenuItem>
        ) : (
          <MenuItem onSelect={() => changeRole(member, 'viewer')}>Make viewer</MenuItem>
        )}
        <MenuItem onSelect={() => setTransferring(member)}>Make owner</MenuItem>
        <MenuItem onSelect={() => setRemoving(member)}>Remove</MenuItem>
      </Menu>
    );
  };

  const columns = useMemo<DataTableColumn<UserSummaryDto>[]>(() => {
    const base: DataTableColumn<UserSummaryDto>[] = [
      {
        id: 'member',
        header: 'Member',
        value: (member) => member.displayName,
        sortable: true,
        cell: (member) => (
          <Inline gap={2} align="center">
            {/* Marks the owner's row so its selection checkbox can be hidden via CSS. */}
            {member.id === project.ownerId ? <span data-atlas-owner hidden /> : null}
            <Avatar name={member.displayName} size="sm" />
            <Stack gap={0}>
              <Inline gap={2} align="center">
                <Text>{member.displayName}</Text>
                {member.id === session?.id ? (
                  <Badge variant="outline" size="sm">
                    You
                  </Badge>
                ) : null}
                {member.disabled ? (
                  <Badge variant="outline" size="sm">
                    Disabled
                  </Badge>
                ) : null}
              </Inline>
              <Text size="sm">@{member.username}</Text>
            </Stack>
          </Inline>
        ),
      },
      {
        id: 'role',
        header: 'Project role',
        value: (member) => ROLE_LABELS[projectRoleFor(project, member.id) ?? 'editor'],
        sortable: true,
        cell: (member) => {
          const role = projectRoleFor(project, member.id) ?? 'editor';
          return (
            <Badge variant={role === 'owner' ? 'solid' : 'outline'} size="sm">
              {ROLE_LABELS[role]}
            </Badge>
          );
        },
      },
    ];

    if (!canManage) return base;

    return [
      ...base,
      {
        id: 'actions',
        header: '',
        align: 'end',
        cell: (member) => renderMemberActions(member),
      },
    ];
    // renderMemberActions closes over stable handlers; project drives the role.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, project, session?.id]);

  return (
    <Stack gap={3}>
      {canManage && candidates.length > 0 ? (
        <Inline justify="end">
          <Select
            value=""
            aria-label="Add a member"
            placeholder="Add a member"
            disabled={addMember.isPending}
            options={[
              { value: '', label: 'Add a member' },
              ...candidates.map((user) => ({
                value: user.id,
                label: `${user.displayName} (@${user.username})`,
              })),
            ]}
            onValueChange={add}
          />
        </Inline>
      ) : null}

      {canManage && removableSelected.length > 0 ? (
        <Inline gap={2} align="center" justify="between">
          <Badge variant="solid">{removableSelected.length} selected</Badge>
          <Button variant="inverse" onClick={() => setBulkRemoving(true)}>
            Remove selected
          </Button>
        </Inline>
      ) : null}

      {isMobile ? (
        members.length === 0 ? (
          <Text size="sm">No members yet.</Text>
        ) : (
          <Stack gap={2}>
            {members.map((member) => {
              const role = projectRoleFor(project, member.id) ?? 'editor';
              const isOwner = member.id === project.ownerId;
              return (
                <div key={member.id} className="atlas-record-card">
                  <Stack gap={2}>
                    <Inline gap={2} align="start" justify="between" wrap={false}>
                      <Inline gap={3} align="center" style={{ minWidth: 0 }}>
                        {canManage && !isOwner ? (
                          <Checkbox
                            aria-label={`Select ${member.displayName}`}
                            checked={selectedIds.includes(member.id)}
                            onChange={(event) =>
                              setSelectedIds((prev) =>
                                event.target.checked
                                  ? [...new Set([...prev, member.id])]
                                  : prev.filter((id) => id !== member.id),
                              )
                            }
                          />
                        ) : null}
                        <Avatar name={member.displayName} size="sm" />
                        <Stack gap={0}>
                          <Inline gap={2} align="center">
                            <Text weight="bold">{member.displayName}</Text>
                            {member.id === session?.id ? (
                              <Badge variant="outline" size="sm">
                                You
                              </Badge>
                            ) : null}
                            {member.disabled ? (
                              <Badge variant="outline" size="sm">
                                Disabled
                              </Badge>
                            ) : null}
                          </Inline>
                          <Text size="sm">@{member.username}</Text>
                        </Stack>
                      </Inline>
                      {renderMemberActions(member)}
                    </Inline>
                    <Badge variant={role === 'owner' ? 'solid' : 'outline'} size="sm">
                      {ROLE_LABELS[role]}
                    </Badge>
                  </Stack>
                </div>
              );
            })}
          </Stack>
        )
      ) : (
        <DataTable
          aria-label={`Members of ${project.name}`}
          className={canManage ? 'atlas-actions-table' : undefined}
          columns={columns}
          data={members}
          getRowId={(member) => member.id}
          filterable={true}
          filterPlaceholder="Search members"
          emptyMessage="No members yet."
          selectable={canManage}
          selectedIds={canManage ? selectedIds : undefined}
          onSelectionChange={canManage ? (ids) => setSelectedIds(ids.map(String)) : undefined}
          pageSize={10}
        />
      )}

      <ConfirmDialog
        isOpen={removing != null}
        tone="danger"
        title={removing ? `Remove ${removing.displayName}?` : 'Remove member?'}
        description="They lose access to this project, and any tasks assigned to them here become unassigned."
        confirmLabel="Remove"
        isLoading={removeMember.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />

      <ConfirmDialog
        isOpen={bulkRemoving}
        tone="danger"
        title={`Remove ${removableSelected.length} member${removableSelected.length === 1 ? '' : 's'}?`}
        description="They lose access to this project, and any tasks assigned to them here become unassigned."
        confirmLabel="Remove"
        isLoading={bulkPending}
        onCancel={() => setBulkRemoving(false)}
        onConfirm={() => void confirmBulkRemove()}
      />

      <ConfirmDialog
        isOpen={transferring != null}
        title={transferring ? `Make ${transferring.displayName} the owner?` : 'Transfer ownership?'}
        description="They will be able to edit, archive and manage members. You stay a member."
        confirmLabel="Transfer"
        isLoading={transferOwnership.isPending}
        onCancel={() => setTransferring(null)}
        onConfirm={confirmTransfer}
      />
    </Stack>
  );
}
