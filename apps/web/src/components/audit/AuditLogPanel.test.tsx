import '@testing-library/jest-dom/vitest';

import type { AuditLogDto, AuditLogPageDto } from '@atlas/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type * as AuditLib from '../../lib/audit.ts';
import { AuditLogPanel } from './AuditLogPanel.tsx';

const rows: AuditLogDto[] = [
  {
    id: 'a1',
    actorUserId: 'u1',
    actorUsername: 'ada',
    action: 'task.create',
    entityType: 'task',
    entityId: 't1',
    projectId: null,
    projectName: 'Website',
    metadata: { title: 'Ship it' },
    createdAt: new Date('2026-01-01T10:00:00Z').toISOString(),
  },
];

const page: AuditLogPageDto = { rows, total: 1 };

vi.mock('../../lib/audit.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof AuditLib>();
  return { ...actual, useAuditLogs: () => ({ data: page, isPending: false }) };
});

vi.mock('../../lib/organization.ts', () => ({
  useUsers: () => ({ data: [{ id: 'u1', displayName: 'Ada', username: 'ada' }] }),
}));

describe('AuditLogPanel', () => {
  it('renders an entry with its action label, actor and summary', () => {
    render(<AuditLogPanel />);

    expect(screen.getByText('Task created')).toBeInTheDocument();
    expect(screen.getByText('ada')).toBeInTheDocument();
    expect(screen.getByText('Ship it')).toBeInTheDocument();
  });

  it('renders the datatable columns and a filter input', () => {
    render(<AuditLogPanel />);

    for (const header of ['When', 'Action', 'Person', 'Details']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(header) })).toBeInTheDocument();
    }
    expect(screen.getByPlaceholderText('Filter activity...')).toBeInTheDocument();
  });
});
