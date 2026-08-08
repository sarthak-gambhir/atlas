import { exportQuerySchema, importRequestSchema } from '@atlas/shared';
import type { FastifyPluginAsync } from 'fastify';

import { requireAdmin, requireAuth } from '../auth/context.ts';
import { buildBackup, restoreBackup } from '../backup.ts';

export const dataRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get('/export', async (request, reply) => {
    const { projectIds } = exportQuerySchema.parse(request.query);
    const bundle = await buildBackup(app.db, { projectIds });
    const stamp = new Date().toISOString().slice(0, 10);

    return reply
      .header('content-disposition', `attachment; filename="atlas-${stamp}.json"`)
      .send(bundle);
  });

  app.post('/import', { preHandler: requireAdmin }, async (request) => {
    const { mode, bundle, assigneeMap, memberResolution } = importRequestSchema.parse(request.body);
    return {
      result: await restoreBackup(
        app.db,
        bundle,
        mode,
        request.user!.id,
        assigneeMap,
        memberResolution,
      ),
    };
  });
};
