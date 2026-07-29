import { fileURLToPath } from 'node:url';

import { DEFAULT_SCORING } from '@atlas/shared';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import { hashPassword } from '../auth/password.ts';
import { createDatabase, type Database } from '../db/index.ts';
import { createProject, updateProject } from '../repositories/projects.ts';
import { scoringContext, createTask } from '../repositories/tasks.ts';
import { createUser } from '../repositories/users.ts';

/**
 * Fixed credentials the Playwright global setup logs in with. Kept in one place
 * so the spec and the seed cannot drift apart.
 */
export const E2E_ADMIN = { username: 'e2e-admin', displayName: 'Ada Admin', password: 'e2e-password-123' };
export const E2E_MEMBER = { username: 'e2e-member', displayName: 'Milo Member', password: 'e2e-password-123' };

const PG_INVALID_CATALOG_NAME = '3D000';
const PG_DUPLICATE_DATABASE = '42P04';

function migrationsFolder(): string {
  return fileURLToPath(new URL('../../drizzle', import.meta.url));
}

/** Days from today as a YYYY-MM-DD string, so seeded due dates read sensibly against "now". */
function dueInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Creates the target database if it does not exist yet, so a fresh checkout just works. */
async function ensureDatabaseExists(url: string): Promise<void> {
  const target = new URL(url);
  const databaseName = target.pathname.replace(/^\//, '');

  const probe = new pg.Client({ connectionString: url });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (error) {
    if ((error as { code?: string }).code !== PG_INVALID_CATALOG_NAME) throw error;
    await probe.end().catch(() => undefined);
  }

  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: maintenance.toString() });
  await admin.connect();
  try {
    // Identifiers cannot be parameterised; the name is our own, not user input.
    await admin.query(`create database "${databaseName}"`);
  } catch (error) {
    if ((error as { code?: string }).code !== PG_DUPLICATE_DATABASE) throw error;
  } finally {
    await admin.end();
  }
}

async function wipe(db: Database): Promise<void> {
  // Same table set the API tests truncate; keep them in sync.
  await db.execute(
    sql`truncate table login_attempts, sessions, task_tags, tasks, tags, projects, settings, users restart identity cascade`,
  );
}

export async function seedE2eDatabase(url: string): Promise<void> {
  await ensureDatabaseExists(url);

  const { db, close } = createDatabase(url);
  try {
    await migrate(db, { migrationsFolder: migrationsFolder() });
    await wipe(db);

    const admin = await createUser(db, {
      username: E2E_ADMIN.username,
      displayName: E2E_ADMIN.displayName,
      passwordHash: await hashPassword(E2E_ADMIN.password),
      role: 'admin',
    });
    const member = await createUser(db, {
      username: E2E_MEMBER.username,
      displayName: E2E_MEMBER.displayName,
      passwordHash: await hashPassword(E2E_MEMBER.password),
      role: 'member',
    });

    const website = await createProject(db, {
      name: 'Website relaunch',
      description: 'Marketing site rebuild on the new design system.',
    });
    const platform = await createProject(db, {
      name: 'Platform',
      description: 'Internal tooling and reliability work.',
    });
    const archived = await createProject(db, { name: 'Legacy migration' });

    const ctx = scoringContext(DEFAULT_SCORING);

    const seedTasks = [
      { title: 'Fix checkout crash on Safari', status: 'in_progress', impact: 5, effort: 2, projectId: platform.id, assigneeId: admin.id, dueDate: dueInDays(1), tags: ['bug', 'urgent'] },
      { title: 'Ship new pricing page', status: 'backlog', impact: 5, effort: 3, projectId: website.id, assigneeId: member.id, dueDate: dueInDays(5), tags: ['growth'] },
      { title: 'Add SSO for enterprise accounts', status: 'backlog', impact: 4, effort: 5, projectId: platform.id, assigneeId: admin.id, tags: ['enterprise'] },
      { title: 'Migrate blog off the old CMS', status: 'backlog', impact: 2, effort: 4, projectId: website.id, tags: ['content'] },
      { title: 'Reduce API p95 latency', status: 'in_progress', impact: 4, effort: 3, projectId: platform.id, assigneeId: member.id, dueDate: dueInDays(9), tags: ['performance'] },
      { title: 'Refresh onboarding emails', status: 'backlog', impact: 3, effort: 1, projectId: website.id, assigneeId: member.id, tags: ['growth', 'content'] },
      { title: 'Audit third-party scripts', status: 'backlog', impact: 3, effort: 2, projectId: website.id, dueDate: dueInDays(14) },
      { title: 'Roll out feature flags service', status: 'backlog', impact: 4, effort: 4, projectId: platform.id, assigneeId: admin.id, tags: ['infra'] },
      { title: 'Write incident runbook', status: 'done', impact: 2, effort: 1, projectId: platform.id, assigneeId: admin.id, tags: ['infra'] },
      { title: 'Design dark mode palette', status: 'done', impact: 3, effort: 2, projectId: website.id, assigneeId: member.id },
      { title: 'Prototype command palette', status: 'in_progress', impact: 3, effort: 2, assigneeId: admin.id, tags: ['ux'] },
      { title: 'Deprecate v1 export endpoint', status: 'backlog', impact: 1, effort: 1, projectId: platform.id },
    ] as const;

    for (const task of seedTasks) {
      await createTask(
        db,
        {
          title: task.title,
          status: task.status,
          impact: task.impact,
          effort: task.effort,
          projectId: 'projectId' in task ? task.projectId : null,
          assigneeId: 'assigneeId' in task ? task.assigneeId : null,
          dueDate: 'dueDate' in task ? task.dueDate : null,
          tags: 'tags' in task ? [...task.tags] : [],
        },
        admin.id,
        ctx,
      );
    }

    // One archived project so the Projects "Show archived" toggle has something to reveal.
    await updateProject(db, archived.id, { archived: true });
  } finally {
    await close();
  }
}

// Run directly: `node apps/server/src/scripts/seed-e2e.ts`, DATABASE_URL pointing at the e2e database.
const invokedDirectly = fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL must point at the e2e database.');
    process.exit(1);
  }

  await seedE2eDatabase(url);
  console.log(`Seeded e2e database at ${new URL(url).pathname.replace(/^\//, '')}`);
}
