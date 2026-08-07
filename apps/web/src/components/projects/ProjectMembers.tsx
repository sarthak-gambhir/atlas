import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Icon,
  Inline,
  Input,
  Menu,
  MenuItem,
  Stack,
  Text,
  useToast,
  type DataTableColumn,
} from '@astrabound/duality';
import type { ProjectDto, ProjectMemberRole, UserSummaryDto } from '@atlas/shared';
import { useMemo, useState, type ReactNode } from 'react';

import { ACTION_ICONS } from '../../lib/icons.ts';
import {
  projectRoleFor,
  useRemoveProjectMember,
  useTransferProjectOwnership,
  useUpdateMemberRole,
  useUsers,
} from '../../lib/organization.ts';
import { useSession } from '../../lib/session.ts';
import { useIsMobile } from '../../lib/useIsMobile.ts';
import { IconLabel } from '../IconLabel.tsx';
import { ManageMembersModal } from './ManageMembersModal.tsx';

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
  const removeMember = useRemoveProjectMember();
  const transferOwnership = useTransferProjectOwnership();
  const updateRole = useUpdateMemberRole();
  const { toast } = useToast();

  const [removing, setRemoving] = useState<UserSummaryDto | null>(null);
  const [transferring, setTransferring] = useState<UserSummaryDto | null>(null);
  const [managing, setManaging] = useState(false);
  const [search, setSearch] = useState('');

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

  const query = search.trim().toLowerCase();
  const visibleMembers =
    query === ''
      ? members
      : members.filter(
          (member) =>
            member.displayName.toLowerCase().includes(query) ||
            member.username.toLowerCase().includes(query),
        );
  const emptyMessage = query === '' ? 'No members yet.' : 'No members match.';

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
            size="md"
            aria-label={`Actions for ${member.displayName}`}
            className="atlas-button atlas-icon-button atlas-action-menu-button"
          >
            <Icon icon={ACTION_ICONS.more} />
          </Button>
        }
      >
        {role === 'viewer' ? (
          <MenuItem onSelect={() => changeRole(member, 'editor')}>
            <IconLabel icon={ACTION_ICONS.role}>Make editor</IconLabel>
          </MenuItem>
        ) : (
          <MenuItem onSelect={() => changeRole(member, 'viewer')}>
            <IconLabel icon={ACTION_ICONS.role}>Make viewer</IconLabel>
          </MenuItem>
        )}
        <MenuItem onSelect={() => setTransferring(member)}>
          <IconLabel icon={ACTION_ICONS.makeOwner}>Make owner</IconLabel>
        </MenuItem>
        <MenuItem onSelect={() => setRemoving(member)}>
          <IconLabel icon={ACTION_ICONS.delete}>Remove</IconLabel>
        </MenuItem>
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
            <Badge variant={role === 'owner' ? 'solid' : 'outline'} size="md">
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
      <Inline gap={2} align="center" justify="between" wrap={false}>
        <div style={{ flex: 1, minInlineSize: 0 }}>
          <Input
            size="lg"
            value={search}
            placeholder="Search members"
            clearable
            aria-label="Search members"
            onClear={() => setSearch('')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {canManage ? (
          <Button
            className="atlas-button"
            size="md"
            variant="solid"
            onClick={() => setManaging(true)}
          >
            <IconLabel icon={ACTION_ICONS.members}>Manage members</IconLabel>
          </Button>
        ) : null}
      </Inline>

      {isMobile ? (
        visibleMembers.length === 0 ? (
          <Text size="sm">{emptyMessage}</Text>
        ) : (
          <Stack gap={2}>
            {visibleMembers.map((member) => {
              const role = projectRoleFor(project, member.id) ?? 'editor';
              return (
                <div key={member.id} className="atlas-record-card">
                  <Stack gap={2}>
                    <Inline gap={2} align="start" justify="between" wrap={false}>
                      <Inline gap={3} align="center" style={{ minWidth: 0 }}>
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
          data={visibleMembers}
          getRowId={(member) => member.id}
          filterable={false}
          emptyMessage={emptyMessage}
          stickyHeader
          pageSize={10}
        />
      )}

      <ConfirmDialog
        isOpen={removing != null}
        closeOnBackdrop={false}
        tone="danger"
        title={removing ? `Remove ${removing.displayName}?` : 'Remove member?'}
        description="They lose access to this project, and any tasks assigned to them here become unassigned."
        confirmLabel="Remove"
        isLoading={removeMember.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />

      <ConfirmDialog
        isOpen={transferring != null}
        closeOnBackdrop={false}
        title={transferring ? `Make ${transferring.displayName} the owner?` : 'Transfer ownership?'}
        description="They will be able to edit, archive and manage members. You stay a member."
        confirmLabel="Transfer"
        isLoading={transferOwnership.isPending}
        onCancel={() => setTransferring(null)}
        onConfirm={confirmTransfer}
      />

      {managing ? (
        <ManageMembersModal
          project={project}
          canManage={canManage}
          isOpen
          onClose={() => setManaging(false)}
        />
      ) : null}
    </Stack>
  );
}
