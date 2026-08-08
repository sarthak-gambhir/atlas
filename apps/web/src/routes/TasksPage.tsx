import { Button, EmptyState, Icon, Inline, Stack } from '@astrabound/duality';
import { useMemo } from 'react';
import { useLocation } from 'react-router';

import { TaskFilterToolbar } from '../components/FilterToolbar.tsx';
import { IconLabel } from '../components/IconLabel.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { TaskTable } from '../components/TaskTable.tsx';
import { useFilters } from '../lib/filters.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { PAGE_ICONS } from '../lib/nav.ts';
import { useProjects } from '../lib/organization.ts';
import { useQuickAdd } from '../lib/quick-add.ts';
import { useSession } from '../lib/session.ts';
import { useTasks } from '../lib/tasks.ts';
import { useBooleanParam } from '../lib/urlState.ts';

export function TasksPage() {
  const filters = useFilters({ includeClosed: true });
  const openQuickAdd = useQuickAdd();
  const { data: projects } = useProjects();
  const { data: session } = useSession();
  const { data: tasks } = useTasks(filters.query);
  const { search } = useLocation();

  // "Favorite projects" and "My projects" are client-side project restrictions,
  // so they and the header count read from the same id sets.
  const [inFavorites, setInFavorites] = useBooleanParam('favorites');
  const [ownedOnly, setOwnedOnly] = useBooleanParam('owned');
  const favoriteProjectIds = useMemo(
    () => (projects ?? []).filter((project) => project.isFavorite).map((project) => project.id),
    [projects],
  );
  const ownedProjectIds = useMemo(
    () =>
      (projects ?? [])
        .filter((project) => session != null && project.ownerId === session.id)
        .map((project) => project.id),
    [projects, session],
  );

  // Each active restriction narrows further, so combine them by intersection.
  const restrictProjectIds = useMemo(() => {
    const sets: string[][] = [];
    if (inFavorites) sets.push(favoriteProjectIds);
    if (ownedOnly) sets.push(ownedProjectIds);
    if (sets.length === 0) return undefined;
    return sets.reduce((acc, ids) => acc.filter((id) => ids.includes(id)));
  }, [inFavorites, ownedOnly, favoriteProjectIds, ownedProjectIds]);

  const shownCount = useMemo(() => {
    if (!restrictProjectIds) return tasks?.length;
    const allowed = new Set(restrictProjectIds);
    return (tasks ?? []).filter((task) => task.projectId != null && allowed.has(task.projectId))
      .length;
  }, [tasks, restrictProjectIds]);

  const isFiltered = filters.isFiltered || inFavorites || ownedOnly;

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
              ownedOnly={ownedOnly}
              onOwnedOnlyChange={setOwnedOnly}
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
        backTarget={{ label: 'Tasks', to: `/tasks${search}` }}
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
