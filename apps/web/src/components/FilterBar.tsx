import { Button, Grid, Inline, Input, Select, Stack } from '@astrabound/duality';
import { TASK_STATUSES, type TaskStatus } from '@atlas/shared';

import { useFilterFacets } from '../lib/filterFacets.ts';
import type { UseFilters } from '../lib/filters.ts';
import { useProjects, useTags, useUsers } from '../lib/organization.ts';
import { STATUS_LABELS } from '../lib/labels.ts';

interface FilterBarProps {
  filters: UseFilters;
  /** The board already splits by status, so it hides that control. */
  showStatus?: boolean;
  /** The board always includes closed (it has a Done column), so it hides this. */
  showClosedToggle?: boolean;
  /** The board renders `done` but never `archived`; keep facet counts in step. */
  excludeArchived?: boolean;
}

export function FilterBar({
  filters,
  showStatus = true,
  showClosedToggle = true,
  excludeArchived = false,
}: FilterBarProps) {
  const { state, set, clear, isFiltered } = filters;
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: tags } = useTags();
  // Cross-filter: each dropdown only offers values consistent with the others.
  const facets = useFilterFacets(state, excludeArchived);

  return (
    <Stack gap={2}>
      {/* Duality controls fill their container, so a bare Inline stacks them into a
          full-width pile. A min-width grid packs them into tidy responsive columns. */}
      <Grid minChildWidth={200} gap={2} align="end">
        <Input
          value={state.q}
          placeholder="Search title and notes"
          clearable
          aria-label="Search tasks"
          onClear={() => set({ q: '' })}
          onChange={(event) => set({ q: event.target.value })}
        />

        {showStatus ? (
          <Select
            value={state.status}
            aria-label="Status"
            options={[
              { value: '', label: 'Any status' },
              ...TASK_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })),
            ]}
            onValueChange={(value) => set({ status: value as TaskStatus | '' })}
          />
        ) : null}

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

        <Select
          value={state.tag}
          aria-label="Tag"
          options={[
            { value: '', label: 'Any tag' },
            ...(tags ?? [])
              .filter((tag) => facets.tagNames.has(tag.name) || tag.name === state.tag)
              .map((tag) => ({
                value: tag.name,
                // Live count within the current project/assignee selection; the
                // global count is only a pre-load fallback.
                label: `${tag.name} (${facets.tagCounts.get(tag.name) ?? tag.taskCount})`,
              })),
          ]}
          onValueChange={(value) => set({ tag: value })}
        />
      </Grid>

      {showClosedToggle || isFiltered ? (
        <Inline gap={2} align="center">
          {showClosedToggle ? (
            <Button
              variant={'inverse'}
              onClick={() => set({ includeClosed: !state.includeClosed })}
            >
              {state.includeClosed ? 'Hide closed' : 'Show closed'}
            </Button>
          ) : null}

          {isFiltered ? (
            <Button variant="ghost" onClick={clear}>
              Clear
            </Button>
          ) : null}
        </Inline>
      ) : null}
    </Stack>
  );
}
