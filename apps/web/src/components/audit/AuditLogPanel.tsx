import { Badge, DataTable, Heading, Stack, Text, type DataTableColumn } from '@astrabound/duality';
import type { AuditLogDto } from '@atlas/shared';

import { auditActionLabel, describeAuditEntry, useAuditLogs } from '../../lib/audit.ts';

const columns: DataTableColumn<AuditLogDto>[] = [
  {
    id: 'createdAt',
    header: 'When',
    cell: (row) => new Date(row.createdAt).toLocaleString(),
    value: (row) => row.createdAt,
    sortable: true,
  },
  {
    id: 'action',
    header: 'Action',
    cell: (row) => <Badge variant="outline">{auditActionLabel(row.action)}</Badge>,
    value: (row) => auditActionLabel(row.action),
    sortable: true,
  },
  {
    id: 'actor',
    header: 'Actor',
    cell: (row) => row.actorUsername,
    value: (row) => row.actorUsername,
    sortable: true,
  },
  {
    id: 'details',
    header: 'Details',
    cell: (row) => describeAuditEntry(row),
    value: (row) => `${describeAuditEntry(row)} ${row.projectName ?? ''}`,
  },
];

export function AuditLogPanel() {
  // Pull a generous newest-first window; the DataTable handles search, sorting
  // and paging client-side, which keeps this panel simple.
  const { data, isPending } = useAuditLogs({ limit: 200 });
  const rows = data?.rows ?? [];

  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <Heading level={3} visualLevel={5}>
          Audit log
        </Heading>
        <Text size="sm">
          Every change to tasks, projects, memberships and people. Demo activity is excluded.
        </Text>
      </Stack>

      <DataTable
        aria-label="Audit log"
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        filterable
        filterPlaceholder="Filter activity..."
        initialSort={{ columnId: 'createdAt', direction: 'desc' }}
        pageSize={25}
        isLoading={isPending}
        emptyMessage="No activity yet. Changes to tasks, projects and people will show up here."
      />
    </Stack>
  );
}
