import { Button, EmptyState, Icon, Inline, Stack } from '@astrabound/duality';
import { useMemo, useState } from 'react';

import { TaskFilterToolbar } from '../components/FilterToolbar.tsx';
import { IconLabel } from '../components/IconLabel.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { TaskTable } from '../components/TaskTable.tsx';
import { useFilters } from '../lib/filters.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { PAGE_ICONS } from '../lib/nav.ts';
import { useProjects } from '../lib/organization.ts';
import { useQuickAdd } from '../lib/quick-add.ts';
import { useTasks } from '../lib/tasks.ts';

export function TasksPage() {
  const filters = useFilters({ includeClosed: true });
  const openQuickAdd = useQuickAdd();
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

  const isFiltered = filters.isFiltered || inFavorites;

  return (
    <Stack gap={4}>
      <PageHeader
        title="Tasks"
        icon={PAGE_ICONS.tasks}
        count={shownCount}
        actions={
          <Inline gap={2} align="center">
            <TaskFilterToolbar
              filters={filters}
              inFavorites={inFavorites}
              onInFavoritesChange={setInFavorites}
            />
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

      <TaskTable
        query={filters.query}
        ariaLabel="Ranked tasks"
        restrictProjectIds={restrictProjectIds}
        backTarget={{ label: 'Tasks', to: '/' }}
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
