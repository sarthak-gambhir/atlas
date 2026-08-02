import { Button, EmptyState, Stack } from '@astrabound/duality';

import { FilterBar } from '../components/FilterBar.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { TaskTable } from '../components/TaskTable.tsx';
import { useFilters } from '../lib/filters.ts';
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
          <Button variant="solid" onClick={() => openQuickAdd()}>
            New task
          </Button>
        }
      />

      <FilterBar filters={filters} />

      <TaskTable
        query={filters.query}
        ariaLabel="Ranked backlog"
        emptyState={
          <EmptyState
            title={filters.isFiltered ? 'Nothing matches' : 'No tasks yet'}
            description={
              filters.isFiltered
                ? 'Try a different search or clear the filters.'
                : 'Add the first task and Atlas will rank it for you.'
            }
            action={
              filters.isFiltered ? null : (
                <Button variant="solid" onClick={() => openQuickAdd()}>
                  New task
                </Button>
              )
            }
          />
        }
      />
    </Stack>
  );
}
