import { Button, Input, Select, Stack } from '@astrabound/duality';
import { TASK_STATUSES, type TaskStatus } from '@atlas/shared';

import { useFilterFacets } from '../lib/filterFacets.ts';
import type { UseFilters } from '../lib/filters.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { STATUS_LABELS } from '../lib/labels.ts';
import { useProjects, useTags, useUsers } from '../lib/organization.ts';
import { IconLabel } from './IconLabel.tsx';

export interface TaskFilterFieldsProps {
  filters: UseFilters;
  /** The board already splits by status, so it hides that control. */
  showStatus?: boolean;
  /** The board always includes closed (it has a Done column), so it hides this. */
  showClosedToggle?: boolean;
  /** The board renders `done` but never `archived`; keep facet counts in step. */
  excludeArchived?: boolean;
}

/** Task filter controls for a popover or modal panel. */
export function TaskFilterFields({
  filters,
  showStatus = true,
  showClosedToggle = true,
  excludeArchived = false,
}: TaskFilterFieldsProps) {
  const { state, set, clear, isFiltered } = filters;
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: tags } = useTags();
  const facets = useFilterFacets(state, excludeArchived);

  return (
    <Stack gap={3}>
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
              label: `${tag.name} (${facets.tagCounts.get(tag.name) ?? tag.taskCount})`,
            })),
        ]}
        onValueChange={(value) => set({ tag: value })}
      />

      {showClosedToggle ? (
        <Button
          className="atlas-button"
          size="md"
          variant="inverse"
          onClick={() => set({ includeClosed: !state.includeClosed })}
        >
          <IconLabel icon={state.includeClosed ? ACTION_ICONS.hide : ACTION_ICONS.reveal}>
            {state.includeClosed ? 'Hide closed' : 'Show closed'}
          </IconLabel>
        </Button>
      ) : null}

      {isFiltered ? (
        <Button className="atlas-button" size="md" variant="ghost" onClick={clear}>
          Clear
        </Button>
      ) : null}
    </Stack>
  );
}
