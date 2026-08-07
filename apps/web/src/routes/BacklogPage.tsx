import { Button, EmptyState, Icon, Inline, Stack } from '@astrabound/duality';

import { TaskFilterToolbar } from '../components/FilterToolbar.tsx';
import { IconLabel } from '../components/IconLabel.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { TaskTable } from '../components/TaskTable.tsx';
import { useFilters } from '../lib/filters.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { useQuickAdd } from '../lib/quick-add.ts';
import { useTasks } from '../lib/tasks.ts';

export function BacklogPage() {
  const filters = useFilters();
  const openQuickAdd = useQuickAdd();
  const { data: tasks } = useTasks(filters.query);

  return (
    <Stack gap={4}>
      <PageHeader
        title="Backlog"
        count={tasks?.length}
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

      <TaskTable
        query={filters.query}
        ariaLabel="Ranked backlog"
        emptyState={
          <EmptyState
            icon={
              <Icon
                icon={filters.isFiltered ? ACTION_ICONS.noResults : ACTION_ICONS.task}
                size="lg"
              />
            }
            title={filters.isFiltered ? 'Nothing matches' : 'No tasks yet'}
            description={
              filters.isFiltered
                ? 'Try a different search or clear the filters.'
                : 'Add the first task and Atlas will rank it for you.'
            }
            action={
              filters.isFiltered ? null : (
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
