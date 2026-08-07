import { Button, EmptyState, Icon, Inline, Stack } from '@astrabound/duality';
import { useMemo, useState } from 'react';

import { TaskFilterToolbar } from '../components/FilterToolbar.tsx';
import { IconLabel } from '../components/IconLabel.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { QuickFilterBar, QuickFilterChip } from '../components/QuickFilterChip.tsx';
import { TaskTable } from '../components/TaskTable.tsx';
import { useFilters } from '../lib/filters.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { PAGE_ICONS } from '../lib/nav.ts';
import { useProjects } from '../lib/organization.ts';
import { useQuickAdd } from '../lib/quick-add.ts';
import { useSession } from '../lib/session.ts';
import { useTasks } from '../lib/tasks.ts';

export function TasksPage() {
  const filters = useFilters({ includeClosed: true });
  const openQuickAdd = useQuickAdd();
  const { data: session } = useSession();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks(filters.query);

  // The "In favorite projects" chip is a client-side project restriction, so it
  // and the header count both read from the same favorite set.
  const [inFavorites, setInFavorites] = useState(false);
  const favoriteProjectIds = useMemo(
    () => (projects ?? []).filter((project) => project.isFavorite).map((project) => project.id),
    [projects],
  );
  const restrictProjectIds = inFavorites ? favoriteProjectIds : undefined;

  const shownCount = useMemo(() => {
    if (!inFavorites) return tasks?.length;
    const allowed = new Set(favoriteProjectIds);
    return (tasks ?? []).filter((task) => task.projectId != null && allowed.has(task.projectId))
      .length;
  }, [tasks, inFavorites, favoriteProjectIds]);

  const { state, set } = filters;
  const assignedToMe = session != null && state.assigneeId === session.id;
  const isFiltered = filters.isFiltered || inFavorites;

  return (
    <Stack gap={4}>
      <PageHeader
        title="Tasks"
        icon={PAGE_ICONS.tasks}
        count={shownCount}
        actions={
          <Inline gap={2} align="center">
            <TaskFilterToolbar filters={filters} />
            <Button
              className="atlas-button"
              size="md"
              variant="solid"
              onClick={() => openQuickAdd()}
            >
              <IconLabel icon={ACTION_ICONS.create}>New task</IconLabel>
            </Button>
          </Inline>
        }
      />

      <QuickFilterBar>
        {session ? (
          <QuickFilterChip
            icon={ACTION_ICONS.assignee}
            active={assignedToMe}
            onToggle={() => set({ assigneeId: assignedToMe ? '' : session.id })}
          >
            Assigned to me
          </QuickFilterChip>
        ) : null}
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
        <QuickFilterChip
          icon={ACTION_ICONS.favorite}
          active={inFavorites}
          onToggle={() => setInFavorites((prev) => !prev)}
        >
          Favorite projects
        </QuickFilterChip>
      </QuickFilterBar>

      <TaskTable
        query={filters.query}
        ariaLabel="Ranked tasks"
        restrictProjectIds={restrictProjectIds}
        emptyState={
          <EmptyState
            icon={<Icon icon={isFiltered ? ACTION_ICONS.noResults : ACTION_ICONS.task} size="lg" />}
            title={isFiltered ? 'Nothing matches' : 'No tasks yet'}
            description={
              isFiltered
                ? 'Try a different search or clear the filters.'
                : 'Add the first task and Atlas will rank it for you.'
            }
            action={
              isFiltered ? null : (
                <Button
                  className="atlas-button"
                  size="lg"
                  variant="solid"
                  onClick={() => openQuickAdd()}
                >
                  <IconLabel icon={ACTION_ICONS.create}>New task</IconLabel>
                </Button>
              )
            }
          />
        }
      />
    </Stack>
  );
}
