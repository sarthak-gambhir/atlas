import { Alert, Button, EmptyState, Grid, Icon, Inline, Stack } from '@astrabound/duality';
import type { ProjectDto } from '@atlas/shared';
import { useMemo, useState } from 'react';

import { ProjectFilterToolbar } from '../components/FilterToolbar.tsx';
import { IconLabel } from '../components/IconLabel.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { ProjectCard } from '../components/projects/ProjectCard.tsx';
import { ProjectFormModal } from '../components/projects/ProjectFormModal.tsx';
import { ACTION_ICONS } from '../lib/icons.ts';
import { useProjects } from '../lib/organization.ts';
import { useSession } from '../lib/session.ts';

/** `null` when the form is closed, `{}` when creating, `{ project }` when editing. */
type FormState = { project?: ProjectDto } | null;

export function ProjectsPage() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState>(null);

  const { data: projects, isPending, error } = useProjects(includeArchived);
  const { data: session } = useSession();
  const isAdmin = session?.role === 'admin';

  const trimmedSearch = search.trim();
  const isFiltered = trimmedSearch !== '' || includeArchived;
  const activeCount = (trimmedSearch ? 1 : 0) + (includeArchived ? 1 : 0);

  const filtered = useMemo(() => {
    const query = trimmedSearch.toLowerCase();
    if (query === '') return projects ?? [];
    return (projects ?? []).filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        (project.description?.toLowerCase().includes(query) ?? false),
    );
  }, [projects, trimmedSearch]);

  const clearFilters = () => {
    setSearch('');
    setIncludeArchived(false);
  };

  return (
    <Stack gap={4}>
      <PageHeader
        title="Projects"
        count={projects?.length}
        actions={
          <Inline gap={2} align="center">
            <ProjectFilterToolbar
              search={search}
              onSearchChange={setSearch}
              includeArchived={includeArchived}
              onIncludeArchivedChange={setIncludeArchived}
              isFiltered={isFiltered}
              activeCount={activeCount}
              onClear={clearFilters}
            />
            <Button className="atlas-button" size="md" variant="solid" onClick={() => setForm({})}>
              <IconLabel icon={ACTION_ICONS.create}>New project</IconLabel>
            </Button>
          </Inline>
        }
      />

      {error ? <Alert tone="error">{error.message}</Alert> : null}

      {!isPending && filtered.length === 0 ? (
        <EmptyState
          icon={
            <Icon icon={trimmedSearch ? ACTION_ICONS.noResults : ACTION_ICONS.project} size={64} />
          }
          title={trimmedSearch ? 'No projects match' : 'No projects yet'}
          description={
            trimmedSearch
              ? 'Try a different search.'
              : 'Projects are optional: tasks can live without one.'
          }
          action={
            trimmedSearch ? null : (
              <Button variant="solid" onClick={() => setForm({})}>
                <IconLabel icon={ACTION_ICONS.create}>New project</IconLabel>
              </Button>
            )
          }
        />
      ) : (
        <Grid minChildWidth={300} gap={3}>
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isAdmin={isAdmin}
              onEdit={() => setForm({ project })}
            />
          ))}
        </Grid>
      )}

      {form ? (
        <ProjectFormModal project={form.project} isOpen onClose={() => setForm(null)} />
      ) : null}
    </Stack>
  );
}
