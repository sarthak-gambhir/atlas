import {
  AUDIT_PAGE_SIZE,
  type AuditAction,
  type AuditLogDto,
  type AuditLogPageDto,
  type AuditQuery,
} from '@atlas/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from './api.ts';

export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (query: AuditQuery) => ['audit-logs', 'list', query] as const,
};

/** Human labels for each audited action; the raw value is the fallback. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'task.create': 'Task created',
  'task.update': 'Task updated',
  'task.complete': 'Task completed',
  'task.delete': 'Task deleted',
  'task.bulk_update': 'Tasks bulk-updated',
  'project.create': 'Project created',
  'project.update': 'Project updated',
  'project.archive': 'Project archived',
  'project.restore': 'Project restored',
  'project.delete': 'Project deleted',
  'project.member.add': 'Member added',
  'project.member.role': 'Member role changed',
  'project.member.remove': 'Member removed',
  'project.owner.transfer': 'Ownership transferred',
  'user.create': 'User created',
  'user.update': 'User updated',
  'user.disable': 'User disabled',
  'user.delete': 'User deleted',
  'user.password_reset': 'Password reset',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action;
}

/** A short, human sentence describing one audit entry for the list. */
export function describeAuditEntry(entry: AuditLogDto): string {
  const meta = entry.metadata ?? {};
  const title = typeof meta.title === 'string' ? meta.title : null;
  const username = typeof meta.username === 'string' ? meta.username : null;
  const count = typeof meta.count === 'number' ? meta.count : null;

  if (entry.entityType === 'subtask') {
    const kind = typeof meta.subtask === 'string' ? meta.subtask : 'changed';
    const where = entry.projectName ? ` in ${entry.projectName}` : '';
    return `Subtask ${kind}${where}`;
  }
  if (entry.entityType === 'task') {
    if (count != null) return `${count} task${count === 1 ? '' : 's'}`;
    return title ?? (entry.projectName ? `Task in ${entry.projectName}` : 'Task');
  }
  if (entry.entityType === 'project') {
    return entry.projectName ?? 'Project';
  }
  if (entry.entityType === 'user') {
    return username ?? 'User';
  }
  return entry.entityType;
}

function toSearch(query: AuditQuery): string {
  const params = new URLSearchParams();
  if (query.action) params.set('action', query.action);
  if (query.actorUserId) params.set('actorUserId', query.actorUserId);
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.offset != null) params.set('offset', String(query.offset));
  const search = params.toString();
  return search ? `?${search}` : '';
}

export function useAuditLogs(query: AuditQuery = {}) {
  return useQuery({
    queryKey: auditKeys.list(query),
    queryFn: async () => api.get<AuditLogPageDto>(`/audit-logs${toSearch(query)}`),
    // Keep the current page visible while the next one loads.
    placeholderData: keepPreviousData,
  });
}

export { AUDIT_PAGE_SIZE };
