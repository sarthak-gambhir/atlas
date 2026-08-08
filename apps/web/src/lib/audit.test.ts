import type { AuditLogDto } from '@atlas/shared';
import { describe, expect, it } from 'vitest';

import { auditActionLabel, describeAuditEntry } from './audit.ts';

function entry(overrides: Partial<AuditLogDto>): AuditLogDto {
  return {
    id: 'a1',
    actorUserId: 'u1',
    actorUsername: 'ada',
    action: 'task.create',
    entityType: 'task',
    entityId: 't1',
    projectId: null,
    projectName: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('auditActionLabel', () => {
  it('maps known actions to friendly labels', () => {
    expect(auditActionLabel('task.create')).toBe('Task created');
    expect(auditActionLabel('project.member.role')).toBe('Member role changed');
  });

  it('falls back to the raw action for anything unknown', () => {
    expect(auditActionLabel('mystery.action')).toBe('mystery.action');
  });
});

describe('describeAuditEntry', () => {
  it('uses the task title when present', () => {
    expect(describeAuditEntry(entry({ metadata: { title: 'Ship it' } }))).toBe('Ship it');
  });

  it('summarises a bulk update by count', () => {
    expect(
      describeAuditEntry(entry({ action: 'task.bulk_update', metadata: { count: 3 } })),
    ).toBe('3 tasks');
  });

  it('names the project for project entries', () => {
    expect(
      describeAuditEntry(
        entry({ entityType: 'project', action: 'project.update', projectName: 'Website' }),
      ),
    ).toBe('Website');
  });

  it('names the user for user entries', () => {
    expect(
      describeAuditEntry(
        entry({ entityType: 'user', action: 'user.create', metadata: { username: 'grace' } }),
      ),
    ).toBe('grace');
  });

  it('describes a subtask change with its kind and project', () => {
    expect(
      describeAuditEntry(
        entry({ entityType: 'subtask', metadata: { subtask: 'add' }, projectName: 'Website' }),
      ),
    ).toBe('Subtask add in Website');
  });
});
