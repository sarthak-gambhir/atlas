import { scoringSettingsSchema } from '@atlas/shared';
import type { FastifyPluginAsync } from 'fastify';

import { requireAdmin, requireAuth } from '../auth/context.ts';
import { getScoringSettings, saveScoringSettings } from '../repositories/settings.ts';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAuth);

  app.get('/settings/scoring', async () => ({
    scoring: await getScoringSettings(app.db),
  }));

  app.put('/settings/scoring', { preHandler: requireAdmin }, async (request) => {
    const scoring = scoringSettingsSchema.parse(request.body);
    return { scoring: await saveScoringSettings(app.db, scoring) };
  });
};
