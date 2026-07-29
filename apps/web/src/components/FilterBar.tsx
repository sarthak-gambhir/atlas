import { Button, Grid, Inline, Input, Select, Stack } from '@astrabound/duality';
import { TASK_STATUSES, type TaskStatus } from '@atlas/shared';

import type { UseFilters } from '../lib/filters.ts';
import { useProjects, useTags, useUsers } from '../lib/organization.ts';
import { STATUS_LABELS } from '../lib/labels.ts';

interface FilterBarProps {
  filters: UseFilters;
  /** The board already splits by status, so it hides that control. */
  showStatus?: boolean;
}

export function FilterBar({ filters, showStatus = true }: FilterBarProps) {
  const { state, set, clear, isFiltered } = filters;
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: tags } = useTags();

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
            ...(projects ?? []).map((project) => ({ value: project.id, label: project.name })),
          ]}
          onValueChange={(value) => set({ projectId: value })}
        />

        <Select
          value={state.assigneeId}
          aria-label="Assignee"
          options={[
            { value: '', label: 'Anyone' },
            ...(users ?? []).map((user) => ({ value: user.id, label: user.displayName })),
          ]}
          onValueChange={(value) => set({ assigneeId: value })}
        />

        <Select
          value={state.tag}
          aria-label="Tag"
          options={[
            { value: '', label: 'Any tag' },
            ...(tags ?? []).map((tag) => ({
              value: tag.name,
              label: `${tag.name} (${tag.taskCount})`,
            })),
          ]}
          onValueChange={(value) => set({ tag: value })}
        />
      </Grid>

      <Inline gap={2} align="center">
        <Button
          variant={state.includeClosed ? 'solid' : 'inverse'}
          onClick={() => set({ includeClosed: !state.includeClosed })}
        >
          Show closed
        </Button>

        {isFiltered ? (
          <Button variant="ghost" onClick={clear}>
            Clear
          </Button>
        ) : null}
      </Inline>
    </Stack>
  );
}
