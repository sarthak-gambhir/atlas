import { useMemo } from 'react';

import type { FilterState } from './filters.ts';
import { useProjects, useTags, useUsers } from './organization.ts';
import { useTasks } from './tasks.ts';

export interface FilterFacets {
  /** Project ids that are consistent with the current assignee/tag selection. */
  projectIds: Set<string>;
  /** Assignee ids consistent with the current project/tag selection (disabled users excluded). */
  assigneeIds: Set<string>;
  /** Tag names consistent with the current project/assignee selection. */
  tagNames: Set<string>;
  /**
   * Live task count per tag within the current project/assignee selection.
   * Empty until the task list loads; callers fall back to the global count then.
   */
  tagCounts: Map<string, number>;
}

/**
 * Computes the allowed options for the Project / Assignee / Tag filters using
 * full-intersection faceting: each dropdown is derived from all the OTHER active
 * selections, so any value that stays offered keeps the existing selections
 * valid (no orphaning from user actions).
 *
 * Edges: project<->assignee uses project membership (`memberIds`); every edge
 * involving tags is task-derived. The 3-way faceting always cross-filters by the
 * OTHER two of {project, assignee, tag}, so options never collapse to nothing.
 * Task-derived options and counts are additionally scoped to the tasks the page
 * actually shows (its status / includeClosed state, and `excludeArchived` for the
 * board, which renders `done` but never `archived`) so counts stay consistent
 * with the visible list. While the task list is still loading, task-derived
 * narrowing is skipped so no dropdown is ever momentarily empty.
 *
 * @param excludeArchived Drop archived tasks from facets (the board never shows them).
 */
export function useFilterFacets(state: FilterState, excludeArchived = false): FilterFacets {
  // Unfiltered (but visibility-scoped) task list; closed included so options are
  // complete and stable across pages. Shares the Board's cache key.
  const { data: tasks } = useTasks({ includeClosed: true, includeArchived: true });
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: tags } = useTags();

  const { projectId, assigneeId, tags: selectedTags, statuses, includeClosed, includeArchived } =
    state;

  return useMemo<FilterFacets>(() => {
    const allProjectIds = new Set((projects ?? []).map((p) => p.id));
    const activeUserIds = new Set((users ?? []).filter((u) => !u.disabled).map((u) => u.id));
    const tasksLoaded = tasks != null;

    // A task matches the tag selection if it carries ANY selected tag (OR); an
    // empty selection matches everything.
    const hasTagSelection = selectedTags.length > 0;
    const matchesTags = (t: { tags: string[] }) =>
      !hasTagSelection || t.tags.some((name) => selectedTags.includes(name));

    // The tasks the page actually displays, so task-derived options and counts
    // line up with what's on screen: explicit statuses win, otherwise done is
    // hidden unless includeClosed and archived unless includeArchived (the board
    // additionally never shows archived).
    const scoped = (tasks ?? []).filter((t) => {
      if (excludeArchived && t.status === 'archived') return false;
      if (statuses.length) return statuses.includes(t.status);
      if (!includeClosed && t.status === 'done') return false;
      if (!includeArchived && t.status === 'archived') return false;
      return true;
    });

    // ---- Project options: other dims are assignee (membership) + tag (task) ----
    const projectsForAssignee = () =>
      new Set((projects ?? []).filter((p) => p.memberIds.includes(assigneeId)).map((p) => p.id));
    let projectIds: Set<string>;
    if (assigneeId && hasTagSelection) {
      // Task-derived; before tasks load, fall back to the assignee's memberships.
      projectIds = tasksLoaded
        ? new Set(
            scoped
              .filter((t) => t.assigneeId === assigneeId && matchesTags(t) && t.projectId != null)
              .map((t) => t.projectId as string),
          )
        : projectsForAssignee();
    } else if (assigneeId) {
      projectIds = projectsForAssignee();
    } else if (hasTagSelection) {
      projectIds = tasksLoaded
        ? new Set(
            scoped
              .filter((t) => matchesTags(t) && t.projectId != null)
              .map((t) => t.projectId as string),
          )
        : new Set(allProjectIds);
    } else {
      projectIds = new Set(allProjectIds);
    }
    // Only ever offer known, non-archived projects.
    projectIds = new Set([...projectIds].filter((id) => allProjectIds.has(id)));

    // ---- Assignee options: other dims are project (membership) + tag (task) ----
    const membersOfProject = () =>
      new Set((projects ?? []).find((p) => p.id === projectId)?.memberIds ?? []);
    let assigneeIds: Set<string>;
    if (projectId && hasTagSelection) {
      // Task-derived; before tasks load, fall back to the project's members.
      assigneeIds = tasksLoaded
        ? new Set(
            scoped
              .filter((t) => t.projectId === projectId && matchesTags(t) && t.assigneeId != null)
              .map((t) => t.assigneeId as string),
          )
        : membersOfProject();
    } else if (projectId) {
      assigneeIds = membersOfProject();
    } else if (hasTagSelection) {
      assigneeIds = tasksLoaded
        ? new Set(
            scoped
              .filter((t) => matchesTags(t) && t.assigneeId != null)
              .map((t) => t.assigneeId as string),
          )
        : new Set(activeUserIds);
    } else {
      assigneeIds = new Set(activeUserIds);
    }
    // Never offer disabled users. When users haven't loaded yet, don't narrow.
    if (users) {
      assigneeIds = new Set([...assigneeIds].filter((id) => activeUserIds.has(id)));
    }

    // ---- Tag options: other dims are project + assignee (both task fields) ----
    // Count in the same pass so the dropdown can show a live per-tag count.
    const tagCounts = new Map<string, number>();
    let tagNames: Set<string>;
    if (tasksLoaded) {
      for (const t of scoped) {
        if (projectId && t.projectId !== projectId) continue;
        if (assigneeId && t.assigneeId !== assigneeId) continue;
        for (const name of t.tags) tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);
      }
      tagNames = new Set(tagCounts.keys());
    } else {
      // Before tasks load, offer every known tag rather than none.
      tagNames = new Set((tags ?? []).map((t) => t.name));
    }

    return { projectIds, assigneeIds, tagNames, tagCounts };
  }, [
    tasks,
    projects,
    users,
    tags,
    projectId,
    assigneeId,
    selectedTags,
    statuses,
    includeClosed,
    includeArchived,
    excludeArchived,
  ]);
}
