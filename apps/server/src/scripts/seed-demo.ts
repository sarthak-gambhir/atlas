import { fileURLToPath } from 'node:url';

import {
  DEFAULT_SCORING,
  type CreateTaskInput,
  type ProjectIconKey,
  type TaskStatus,
} from '@atlas/shared';
import { eq } from 'drizzle-orm';

import { DEMO_COLLABORATOR_USERNAME, DEMO_USERNAME } from '../auth/demo.ts';
import { hashPassword } from '../auth/password.ts';
import { createDatabase, type Database } from '../db/index.ts';
import { projects, tasks } from '../db/schema.ts';
import { addProjectMember, createProject, setProjectFavorite } from '../repositories/projects.ts';
import { createTask, scoringContext } from '../repositories/tasks.ts';
import { createUser, findUserByUsername, type UserRecord } from '../repositories/users.ts';

/**
 * The public demo login. Kept here (not secret) so a preview deploy can point
 * people straight at it. Jane never logs in; she exists so assignments and the
 * member list look like a real, shared workspace.
 */
export const DEMO_USER = {
  username: DEMO_USERNAME,
  displayName: 'John Doe',
  password: 'demo-password-123',
} as const;

export const DEMO_COLLABORATOR = {
  username: DEMO_COLLABORATOR_USERNAME,
  displayName: 'Jane Doe',
} as const;

type ProjectKey = 'product' | 'growth' | 'mobile';
type Assignee = 'john' | 'jane';
/** Only the multipliers the schema allows (none is unrealistic for real work). */
type DemoConfidence = 0.5 | 0.8 | 1;

interface DemoTask {
  title: string;
  project: ProjectKey;
  assignee: Assignee;
  status: TaskStatus;
  impact: number;
  effort: number;
  confidence: DemoConfidence;
  /** Deadline as days from today; negative is overdue. Sets `dueEndDate`. */
  dueInDays?: number;
  urgencyOverride?: number;
  tags: string[];
  notes?: string;
  /** For `done` tasks: how long ago it was finished, so history reads sensibly. */
  completedDaysAgo?: number;
  /** Present on pinned tasks; becomes the sparse `manualRank`. */
  pinRank?: number;
}

/** Days from today as a YYYY-MM-DD string, matching the `date` columns. */
function dueInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A `Date` set to N days before now, for backdating completion/creation. */
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function ensureUser(
  db: Database,
  spec: { username: string; displayName: string; password: string; role: 'admin' | 'member' },
): Promise<UserRecord> {
  const existing = await findUserByUsername(db, spec.username);
  if (existing) return existing;
  return createUser(db, {
    username: spec.username,
    displayName: spec.displayName,
    passwordHash: await hashPassword(spec.password),
    role: spec.role,
  });
}

const PROJECTS: Record<
  ProjectKey,
  { name: string; description: string; icon: ProjectIconKey; owner: Assignee }
> = {
  product: {
    name: 'Nimbus Product',
    description: 'The Nimbus web app: dashboards, alerting and integrations.',
    icon: 'rocket',
    owner: 'john',
  },
  growth: {
    name: 'Nimbus Growth',
    description: 'Marketing site, onboarding and product analytics.',
    icon: 'chart',
    owner: 'john',
  },
  mobile: {
    name: 'Nimbus Mobile',
    description: 'The Nimbus iOS and Android apps.',
    icon: 'phone',
    owner: 'jane',
  },
};

const DEMO_TASKS: readonly DemoTask[] = [
  // --- Nimbus Product ---
  {
    title: 'Fix dashboard chart flicker on refresh',
    project: 'product',
    assignee: 'john',
    status: 'in_progress',
    impact: 5,
    effort: 2,
    confidence: 1,
    dueInDays: 2,
    tags: ['bug', 'dashboard'],
    notes: 'Only after a hard refresh; a race between the socket reconnect and the initial fetch.',
    pinRank: 1000,
  },
  {
    title: 'Ship anomaly detection alerts',
    project: 'product',
    assignee: 'john',
    status: 'next',
    impact: 5,
    effort: 4,
    confidence: 0.8,
    dueInDays: 12,
    tags: ['feature', 'alerts'],
    notes: 'MVP uses static thresholds; revisit with a rolling baseline later.',
  },
  {
    title: 'Add webhook integrations (Slack, PagerDuty)',
    project: 'product',
    assignee: 'jane',
    status: 'backlog',
    impact: 4,
    effort: 3,
    confidence: 0.8,
    tags: ['integrations'],
  },
  {
    title: 'Reduce ingestion pipeline p95 latency',
    project: 'product',
    assignee: 'john',
    status: 'in_progress',
    impact: 4,
    effort: 4,
    confidence: 0.8,
    dueInDays: 6,
    tags: ['performance', 'infra'],
  },
  {
    title: 'Role-based access control for teams',
    project: 'product',
    assignee: 'john',
    status: 'backlog',
    impact: 4,
    effort: 5,
    confidence: 0.5,
    tags: ['enterprise'],
  },
  {
    title: 'Fix timezone bug in daily rollups',
    project: 'product',
    assignee: 'jane',
    status: 'blocked',
    impact: 3,
    effort: 2,
    confidence: 1,
    dueInDays: -1,
    urgencyOverride: 4,
    tags: ['bug'],
    notes: 'Blocked on data backfill; rollups drift for users east of UTC.',
  },
  {
    title: 'Export reports to CSV and PDF',
    project: 'product',
    assignee: 'john',
    status: 'backlog',
    impact: 3,
    effort: 3,
    confidence: 1,
    tags: ['feature'],
  },
  {
    title: 'Dark mode for dashboard',
    project: 'product',
    assignee: 'jane',
    status: 'done',
    impact: 3,
    effort: 2,
    confidence: 1,
    tags: ['ux'],
    completedDaysAgo: 5,
  },
  {
    title: 'Onboarding checklist widget',
    project: 'product',
    assignee: 'john',
    status: 'done',
    impact: 2,
    effort: 1,
    confidence: 1,
    tags: ['ux', 'onboarding'],
    completedDaysAgo: 12,
  },
  {
    title: 'Migrate charts to new rendering library',
    project: 'product',
    assignee: 'john',
    status: 'backlog',
    impact: 2,
    effort: 4,
    confidence: 0.5,
    tags: ['tech-debt'],
  },
  {
    title: 'Add saved views and filters',
    project: 'product',
    assignee: 'jane',
    status: 'next',
    impact: 3,
    effort: 2,
    confidence: 1,
    dueInDays: 20,
    tags: ['feature'],
  },
  {
    title: 'Incident timeline view',
    project: 'product',
    assignee: 'john',
    status: 'backlog',
    impact: 4,
    effort: 3,
    confidence: 0.8,
    tags: ['feature', 'alerts'],
  },
  {
    title: 'Deprecate legacy v1 metrics API',
    project: 'product',
    assignee: 'john',
    status: 'archived',
    impact: 1,
    effort: 2,
    confidence: 1,
    tags: ['tech-debt'],
  },

  // --- Nimbus Growth ---
  {
    title: 'Launch new pricing page',
    project: 'growth',
    assignee: 'john',
    status: 'in_progress',
    impact: 5,
    effort: 3,
    confidence: 0.8,
    dueInDays: 4,
    tags: ['growth', 'web'],
    notes: 'New three-tier layout; waiting on final copy from marketing.',
    pinRank: 2000,
  },
  {
    title: 'SEO overhaul for docs',
    project: 'growth',
    assignee: 'jane',
    status: 'backlog',
    impact: 3,
    effort: 3,
    confidence: 0.8,
    tags: ['seo', 'content'],
  },
  {
    title: 'A/B test signup flow',
    project: 'growth',
    assignee: 'john',
    status: 'next',
    impact: 4,
    effort: 2,
    confidence: 0.8,
    dueInDays: 9,
    tags: ['growth', 'experiment'],
  },
  {
    title: 'Rewrite onboarding email sequence',
    project: 'growth',
    assignee: 'jane',
    status: 'backlog',
    impact: 3,
    effort: 1,
    confidence: 1,
    tags: ['content', 'lifecycle'],
  },
  {
    title: 'Publish customer case study (Acme)',
    project: 'growth',
    assignee: 'john',
    status: 'done',
    impact: 2,
    effort: 2,
    confidence: 1,
    tags: ['content'],
    completedDaysAgo: 3,
  },
  {
    title: 'Set up product analytics events',
    project: 'growth',
    assignee: 'john',
    status: 'in_progress',
    impact: 4,
    effort: 3,
    confidence: 0.8,
    dueInDays: 7,
    tags: ['analytics'],
    notes: 'Instrument signup, activation and first-alert-created.',
  },
  {
    title: 'Design new landing hero',
    project: 'growth',
    assignee: 'jane',
    status: 'done',
    impact: 3,
    effort: 2,
    confidence: 1,
    tags: ['design', 'web'],
    completedDaysAgo: 8,
  },
  {
    title: 'Referral program MVP',
    project: 'growth',
    assignee: 'john',
    status: 'backlog',
    impact: 4,
    effort: 4,
    confidence: 0.5,
    tags: ['growth'],
  },
  {
    title: 'Migrate blog to new CMS',
    project: 'growth',
    assignee: 'jane',
    status: 'backlog',
    impact: 2,
    effort: 4,
    confidence: 0.8,
    tags: ['content', 'tech-debt'],
  },
  {
    title: 'Cookie consent and GDPR banner',
    project: 'growth',
    assignee: 'john',
    status: 'next',
    impact: 3,
    effort: 2,
    confidence: 1,
    dueInDays: 5,
    urgencyOverride: 4,
    tags: ['compliance', 'web'],
  },
  {
    title: 'Quarterly growth report',
    project: 'growth',
    assignee: 'john',
    status: 'backlog',
    impact: 2,
    effort: 2,
    confidence: 1,
    dueInDays: 25,
    tags: ['reporting'],
  },

  // --- Nimbus Mobile ---
  {
    title: 'Push notifications for alerts',
    project: 'mobile',
    assignee: 'jane',
    status: 'in_progress',
    impact: 5,
    effort: 4,
    confidence: 0.8,
    dueInDays: 10,
    tags: ['mobile', 'alerts'],
  },
  {
    title: 'Fix crash on cold start (Android 14)',
    project: 'mobile',
    assignee: 'jane',
    status: 'blocked',
    impact: 5,
    effort: 3,
    confidence: 1,
    dueInDays: -2,
    urgencyOverride: 5,
    tags: ['bug', 'android'],
    notes: 'Waiting on vendor SDK fix (tracking VEN-482).',
  },
  {
    title: 'Biometric login (Face ID and fingerprint)',
    project: 'mobile',
    assignee: 'john',
    status: 'next',
    impact: 4,
    effort: 3,
    confidence: 0.8,
    dueInDays: 14,
    tags: ['security', 'mobile'],
  },
  {
    title: 'Offline mode for dashboards',
    project: 'mobile',
    assignee: 'jane',
    status: 'backlog',
    impact: 3,
    effort: 5,
    confidence: 0.5,
    tags: ['mobile', 'feature'],
  },
  {
    title: 'App Store screenshots and listing refresh',
    project: 'mobile',
    assignee: 'john',
    status: 'backlog',
    impact: 2,
    effort: 2,
    confidence: 1,
    tags: ['aso', 'content'],
  },
  {
    title: 'Migrate to React Native 0.75',
    project: 'mobile',
    assignee: 'jane',
    status: 'backlog',
    impact: 2,
    effort: 4,
    confidence: 0.5,
    tags: ['tech-debt', 'mobile'],
  },
  {
    title: 'Home screen widget',
    project: 'mobile',
    assignee: 'jane',
    status: 'done',
    impact: 3,
    effort: 3,
    confidence: 1,
    tags: ['mobile', 'feature'],
    completedDaysAgo: 6,
  },
  {
    title: 'Beta feedback triage',
    project: 'mobile',
    assignee: 'john',
    status: 'next',
    impact: 3,
    effort: 1,
    confidence: 1,
    dueInDays: 3,
    tags: ['mobile'],
  },
];

export interface DemoSeedResult {
  created: boolean;
  john: UserRecord;
  jane: UserRecord;
}

/**
 * Idempotently provisions the demo users and the Nimbus dataset. Never wipes:
 * it creates the users if missing, and seeds the projects and tasks only when
 * John owns no projects yet, so re-running (or a cron) is a safe no-op and any
 * other data in the database is left untouched.
 */
export async function ensureDemoData(db: Database): Promise<DemoSeedResult> {
  const john = await ensureUser(db, { ...DEMO_USER, role: 'member' });
  const jane = await ensureUser(db, {
    ...DEMO_COLLABORATOR,
    // Jane never logs in; a random secret keeps the account unusable by hand.
    password: crypto.randomUUID(),
    role: 'member',
  });

  const owned = await db.select({ id: projects.id }).from(projects).where(eq(projects.ownerId, john.id));
  if (owned.length > 0) return { created: false, john, jane };

  const userId: Record<Assignee, string> = { john: john.id, jane: jane.id };

  // Create each project under its owner, with a default tag to prefill new tasks.
  const projectId = {} as Record<ProjectKey, string>;
  for (const key of Object.keys(PROJECTS) as ProjectKey[]) {
    const def = PROJECTS[key];
    const project = await createProject(
      db,
      {
        name: def.name,
        description: def.description,
        icon: def.icon,
        defaults: { tags: [key] },
      },
      userId[def.owner],
    );
    projectId[key] = project.id;
  }

  // Cross-add the other user as an editor so both can be assignees everywhere.
  await addProjectMember(db, projectId.product, jane.id);
  await addProjectMember(db, projectId.growth, jane.id);
  await addProjectMember(db, projectId.mobile, john.id);

  const ctx = scoringContext(DEFAULT_SCORING);

  for (const task of DEMO_TASKS) {
    const createdBy = userId[PROJECTS[task.project].owner];
    const input: CreateTaskInput = {
      title: task.title,
      status: task.status,
      projectId: projectId[task.project],
      assigneeId: userId[task.assignee],
      impact: task.impact,
      effort: task.effort,
      confidence: task.confidence,
      tags: [...task.tags],
      ...(task.notes ? { notes: task.notes } : {}),
      ...(task.dueInDays !== undefined ? { dueEndDate: dueInDays(task.dueInDays) } : {}),
      ...(task.urgencyOverride !== undefined ? { urgencyOverride: task.urgencyOverride } : {}),
    };

    const created = await createTask(db, input, createdBy, ctx);

    // createTask never stamps completedAt (that follows a status change) and
    // always uses "now" for createdAt, so backdate finished work directly.
    if (task.completedDaysAgo !== undefined) {
      const when = daysAgo(task.completedDaysAgo);
      await db.update(tasks).set({ completedAt: when, createdAt: when }).where(eq(tasks.id, created.id));
    }

    if (task.pinRank !== undefined) {
      await db.update(tasks).set({ manualRank: task.pinRank }).where(eq(tasks.id, created.id));
    }
  }

  // John's starred projects: the two he owns and works in most.
  await setProjectFavorite(db, projectId.product, john.id, true);
  await setProjectFavorite(db, projectId.mobile, john.id, true);

  return { created: true, john, jane };
}

// Run directly: `npm run seed-demo`, with DATABASE_URL pointing at the demo database.
const invokedDirectly = fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL must be set (point it at the demo database).');
    process.exit(1);
  }

  const { db, close } = createDatabase(url);
  try {
    const result = await ensureDemoData(db);
    console.log(
      result.created
        ? `Seeded demo data: ${DEMO_TASKS.length} tasks across 3 projects for "${result.john.username}".`
        : `Demo data already present for "${result.john.username}"; nothing to do.`,
    );
  } finally {
    await close();
  }
}
