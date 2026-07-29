import type { TagDto } from '@atlas/shared';
import { asc, eq, sql } from 'drizzle-orm';

import type { Database } from '../db/index.ts';
import { tags, taskTags } from '../db/schema.ts';

export async function listTags(db: Database): Promise<TagDto[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      taskCount: sql<number>`count(${taskTags.taskId})::int`,
    })
    .from(tags)
    .leftJoin(taskTags, eq(taskTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(asc(tags.name));

  return rows;
}

/**
 * Tags are created implicitly by tasks, so they are cleaned up the same way:
 * anything no longer attached to a task is dropped.
 */
export async function pruneUnusedTags(db: Database): Promise<number> {
  const removed = await db
    .delete(tags)
    .where(sql`not exists (select 1 from ${taskTags} where ${taskTags.tagId} = ${tags.id})`)
    .returning({ id: tags.id });

  return removed.length;
}
