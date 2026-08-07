import { Button, Divider, Input, MultiSelect, Select, Stack } from '@astrabound/duality';
import {
  PRIORITY_BUCKETS,
  TASK_STATUSES,
  type PriorityBucket,
  type TaskStatus,
} from '@atlas/shared';

import { useFilterFacets } from '../lib/filterFacets.ts';
import type { UseFilters } from '../lib/filters.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { BUCKET_LABELS, STATUS_LABELS } from '../lib/labels.ts';
import { useProjects, useTags, useUsers } from '../lib/organization.ts';
import { useSession } from '../lib/session.ts';
import { QuickFilterBar, QuickFilterChip } from './QuickFilterChip.tsx';

export interface TaskFilterFieldsProps {
  filters: UseFilters;
  /** The board already splits by status, so it hides that control. */
  showStatus?: boolean;
  /** The board always includes closed (it has a Done column), so it hides this. */
  showClosedToggle?: boolean;
  /** The board renders `done` but never `archived`; keep facet counts in step. */
  excludeArchived?: boolean;
  /** Tasks page only: the client-side "in favorite projects" quick filter. */
  inFavorites?: boolean;
  onInFavoritesChange?: (value: boolean) => void;
}

/** Task filter controls for a popover or modal panel. */
export function TaskFilterFields({
  filters,
  showStatus = true,
  showClosedToggle = true,
  excludeArchived = false,
  inFavorites,
  onInFavoritesChange,
}: TaskFilterFieldsProps) {
  const { state, set, clear, isFiltered } = filters;
  const { data: session } = useSession();
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: tags } = useTags();
  const facets = useFilterFacets(state, excludeArchived);

  // "Assigned to me" and "Favorite projects" are Tasks-page shortcuts; the page
  // opts in by passing an onInFavoritesChange handler.
  const showTaskShortcuts = onInFavoritesChange != null;
  const assignedToMe = session != null && state.assigneeId === session.id;
  const favoriteActive = inFavorites ?? false;
  const showQuickFilters = showClosedToggle || showTaskShortcuts;
  const showClear = isFiltered || favoriteActive;

  return (
    <Stack gap={3}>
      {showQuickFilters ? (
        <>
          <QuickFilterBar>
            {showTaskShortcuts && session ? (
              <QuickFilterChip
                icon={ACTION_ICONS.assignee}
                active={assignedToMe}
                onToggle={() => set({ assigneeId: assignedToMe ? '' : session.id })}
              >
                Assigned to me
              </QuickFilterChip>
            ) : null}
            {showTaskShortcuts ? (
              <QuickFilterChip
                icon={ACTION_ICONS.favorite}
                active={favoriteActive}
                onToggle={() => onInFavoritesChange(!favoriteActive)}
              >
                Favorite projects
              </QuickFilterChip>
            ) : null}
            {showClosedToggle ? (
              <>
                <QuickFilterChip
                  icon={ACTION_ICONS.hide}
                  active={!state.includeClosed}
                  onToggle={() => set({ includeClosed: !state.includeClosed })}
                >
                  Hide closed
                </QuickFilterChip>
                <QuickFilterChip
                  icon={ACTION_ICONS.archive}
                  active={state.includeArchived}
                  onToggle={() => set({ includeArchived: !state.includeArchived })}
                >
                  Show archived
                </QuickFilterChip>
              </>
            ) : null}
          </QuickFilterBar>
          <Divider />
        </>
      ) : null}

      <Input
        value={state.q}
        placeholder="Search title and notes"
        clearable
        aria-label="Search tasks"
        onClear={() => set({ q: '' })}
        onChange={(event) => set({ q: event.target.value })}
      />

      <Select
        value={state.projectId}
        aria-label="Project"
        options={[
          { value: '', label: 'Any project' },
          ...(projects ?? [])
            .filter(
              (project) => facets.projectIds.has(project.id) || project.id === state.projectId,
            )
            .map((project) => ({ value: project.id, label: project.name })),
        ]}
        onValueChange={(value) => set({ projectId: value })}
      />

      <Select
        value={state.assigneeId}
        aria-label="Assignee"
        options={[
          { value: '', label: 'Any assignee' },
          ...(users ?? [])
            .filter((user) => facets.assigneeIds.has(user.id) || user.id === state.assigneeId)
            .map((user) => ({ value: user.id, label: user.displayName })),
        ]}
        onValueChange={(value) => set({ assigneeId: value })}
      />

      {showStatus ? (
        <MultiSelect
          value={state.statuses}
          aria-label="Status"
          placeholder="Any status"
          options={TASK_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
          onValueChange={(value) => set({ statuses: value as TaskStatus[] })}
        />
      ) : null}

      <MultiSelect
        value={state.buckets}
        aria-label="Priority"
        placeholder="Any priority"
        options={PRIORITY_BUCKETS.map((value) => ({
          value,
          label: `${BUCKET_LABELS[value]} (${facets.bucketCounts.get(value) ?? 0})`,
        }))}
        onValueChange={(value) => set({ buckets: value as PriorityBucket[] })}
      />

      <MultiSelect
        value={state.tags}
        aria-label="Tag"
        placeholder="Any tag"
        options={(tags ?? [])
          .filter((tag) => facets.tagNames.has(tag.name) || state.tags.includes(tag.name))
          .map((tag) => ({
            value: tag.name,
            label: `${tag.name} (${facets.tagCounts.get(tag.name) ?? tag.taskCount})`,
          }))}
        onValueChange={(value) => set({ tags: value })}
      />

      {showClear ? (
        <Button
          className="atlas-button"
          size="md"
          variant="ghost"
          onClick={() => {
            clear();
            onInFavoritesChange?.(false);
          }}
        >
          Clear
        </Button>
      ) : null}
    </Stack>
  );
}
