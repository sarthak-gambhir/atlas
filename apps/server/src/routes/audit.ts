import { auditQuerySchema } from '@atlas/shared';
import type { FastifyPluginAsync } from 'fastify';

import { requireAdmin, requireAuth } from '../auth/context.ts';
import { listAuditLogs } from '../repositories/audit.ts';

export const auditRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  /** Admin-only, newest-first, filterable by action and actor with offset paging. */
  app.get('/audit-logs', { preHandler: requireAdmin }, async (request) => {
    const query = auditQuerySchema.parse(request.query);
    return listAuditLogs(app.db, query);
  });
};
