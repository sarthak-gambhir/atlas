import {
  Alert,
  Avatar,
  Badge,
  Button,
  DataTable,
  FormField,
  Inline,
  Select,
  Stack,
  Text,
  type DataTableColumn,
} from '@astrabound/duality';
import type { UserSummaryDto } from '@atlas/shared';
import { useMemo, useState } from 'react';

import { useUsers } from '../../lib/organization.ts';
import { useSession } from '../../lib/session.ts';
import { AddPersonModal } from './AddPersonModal.tsx';
import { EditPersonModal } from './EditPersonModal.tsx';
import { PersonRowActions } from './PersonRowActions.tsx';

type RoleFilter = 'all' | 'admin' | 'member';
type StatusFilter = 'all' | 'active' | 'disabled';

export function PeoplePanel() {
  const { data: users, error } = useUsers();
  const { data: session } = useSession();

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<UserSummaryDto | null>(null);

  const roster = useMemo(() => users ?? [], [users]);
  const activeAdmins = roster.filter((u) => u.role === 'admin' && !u.disabled).length;

  const rows = useMemo(
    () =>
      roster.filter((person) => {
        if (roleFilter !== 'all' && person.role !== roleFilter) return false;
        if (statusFilter === 'active' && person.disabled) return false;
        if (statusFilter === 'disabled' && !person.disabled) return false;
        return true;
      }),
    [roster, roleFilter, statusFilter],
  );

  const columns: DataTableColumn<UserSummaryDto>[] = [
    {
      id: 'person',
      header: 'Person',
      value: (person) => `${person.displayName} ${person.username}`,
      sortable: true,
      cell: (person) => (
        <Inline gap={3} align="center">
          <Avatar name={person.displayName} size="sm" />
          <Stack gap={0}>
            <Inline gap={2} align="center">
              <Text weight="bold">{person.displayName}</Text>
              {person.id === session?.id ? <Badge variant="outline">You</Badge> : null}
            </Inline>
            <Text size="sm">@{person.username}</Text>
          </Stack>
        </Inline>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      value: (person) => person.role,
      sortable: true,
      cell: (person) => (
        <Badge variant={person.role === 'admin' ? 'solid' : 'outline'}>{person.role}</Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      value: (person) => (person.disabled ? 'Disabled' : 'Active'),
      sortable: true,
      cell: (person) =>
        person.disabled ? (
          <Badge variant="outline">Disabled</Badge>
        ) : (
          <Badge variant="solid">Active</Badge>
        ),
    },
    {
      id: 'joined',
      header: 'Joined',
      value: (person) => person.createdAt,
      sortable: true,
      cell: (person) => (
        <Text size="sm">{new Date(person.createdAt).toLocaleDateString()}</Text>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      cell: (person) => (
        <PersonRowActions
          person={person}
          isSelf={person.id === session?.id}
          isLastAdmin={person.role === 'admin' && !person.disabled && activeAdmins <= 1}
          onEdit={() => setEditing(person)}
        />
      ),
    },
  ];

  return (
    <Stack gap={4}>
      {error ? <Alert tone="error">{error.message}</Alert> : null}

      <Inline gap={3} align="end" justify="between">
        <Inline gap={3} align="end">
          <FormField label="Role">
            <Select
              value={roleFilter}
              options={[
                { value: 'all', label: 'All roles' },
                { value: 'admin', label: 'Admins' },
                { value: 'member', label: 'Members' },
              ]}
              onValueChange={(value) => setRoleFilter(value as RoleFilter)}
            />
          </FormField>
          <FormField label="Status">
            <Select
              value={statusFilter}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'disabled', label: 'Disabled' },
              ]}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            />
          </FormField>
        </Inline>

        <Button variant="solid" onClick={() => setAddOpen(true)}>
          Add person
        </Button>
      </Inline>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(person) => person.id}
        filterable
        filterPlaceholder="Search people"
        initialSort={{ columnId: 'person', direction: 'asc' }}
        emptyMessage="No people match these filters."
        aria-label="People"
      />

      <AddPersonModal isOpen={addOpen} onClose={() => setAddOpen(false)} />

      {editing ? (
        <EditPersonModal person={editing} isOpen onClose={() => setEditing(null)} />
      ) : null}
    </Stack>
  );
}
