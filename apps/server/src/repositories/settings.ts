import { DEFAULT_SCORING, type ScoringSettings } from '@atlas/shared';
import { eq } from 'drizzle-orm';

import type { Database } from '../db/index.ts';
import { settings } from '../db/schema.ts';

const SCORING_KEY = 'scoring';

interface PartialScoring {
  weights?: Partial<ScoringSettings['weights']>;
  thresholds?: Partial<ScoringSettings['thresholds']>;
}

/** Falls back to the defaults for anything the stored row does not override. */
export async function getScoringSettings(db: Database): Promise<ScoringSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, SCORING_KEY)).limit(1);
  if (!row) return DEFAULT_SCORING;

  const stored = row.value as PartialScoring;
  return {
    weights: { ...DEFAULT_SCORING.weights, ...stored.weights },
    thresholds: { ...DEFAULT_SCORING.thresholds, ...stored.thresholds },
  };
}

export async function saveScoringSettings(
  db: Database,
  value: ScoringSettings,
): Promise<ScoringSettings> {
  await db
    .insert(settings)
    .values({ key: SCORING_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });

  return value;
}
