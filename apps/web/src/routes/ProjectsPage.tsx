import { Alert, Button, EmptyState, Grid, Inline, Input, Stack } from '@astrabound/duality';
import type { ProjectDto } from '@atlas/shared';
import { useMemo, useState } from 'react';

import { PageHeader } from '../components/PageHeader.tsx';
import { ProjectCard } from '../components/projects/ProjectCard.tsx';
import { ProjectFormModal } from '../components/projects/ProjectFormModal.tsx';
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

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === '') return projects ?? [];
    return (projects ?? []).filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        (project.description?.toLowerCase().includes(query) ?? false),
    );
  }, [projects, search]);

  return (
    <Stack gap={4}>
      <PageHeader
        title="Projects"
        count={projects?.length}
        actions={
          <Button variant="solid" onClick={() => setForm({})}>
            New project
          </Button>
        }
      />

      <Inline gap={3} align="center" justify="between" wrap>
        <Input
          value={search}
          placeholder="Search projects"
          clearable
          aria-label="Search projects"
          onClear={() => setSearch('')}
          onChange={(event) => setSearch(event.target.value)}
          style={{ maxWidth: 320 }}
        />
        <Button variant="inverse" onClick={() => setIncludeArchived((previous) => !previous)}>
          {includeArchived ? 'Hide archived' : 'Show archived'}
        </Button>
      </Inline>

      {error ? <Alert tone="error">{error.message}</Alert> : null}

      {!isPending && filtered.length === 0 ? (
        <EmptyState
          title={search.trim() ? 'No projects match' : 'No projects yet'}
          description={
            search.trim()
              ? 'Try a different search.'
              : 'Projects are optional: tasks can live without one.'
          }
          action={
            search.trim() ? null : (
              <Button variant="solid" onClick={() => setForm({})}>
                New project
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
