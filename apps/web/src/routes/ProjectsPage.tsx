import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  FormField,
  Inline,
  Input,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@astrabound/duality';
import { useState, type FormEvent } from 'react';

import { PageHeader } from '../components/PageHeader.tsx';
import { useCreateProject, useProjects, useUpdateProject } from '../lib/organization.ts';

export function ProjectsPage() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data: projects, isPending, error } = useProjects(includeArchived);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createProject.mutate(
      { name, description: description.trim() === '' ? null : description },
      {
        onSuccess: () => {
          toast({ title: 'Project created', tone: 'success' });
          setName('');
          setDescription('');
        },
        onError: (cause) =>
          toast({ title: 'Could not create project', description: cause.message, tone: 'error' }),
      },
    );
  };

  const setArchived = (id: string, archived: boolean) => {
    updateProject.mutate(
      { id, archived },
      {
        onSuccess: () => toast({ title: archived ? 'Project archived' : 'Project restored' }),
        onError: (cause) =>
          toast({ title: 'Could not update project', description: cause.message, tone: 'error' }),
      },
    );
  };

  return (
    <Stack gap={4}>
      <PageHeader
        title="Projects"
        count={projects?.length}
        actions={
          <Button
            variant={includeArchived ? 'solid' : 'inverse'}
            onClick={() => setIncludeArchived((previous) => !previous)}
          >
            Show archived
          </Button>
        }
      />

      <Card as="form" onSubmit={submit}>
        <CardBody>
          <Stack gap={3}>
            <FormField label="Name" required>
              <Input
                value={name}
                placeholder="Website"
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>

            <FormField label="Description">
              <Textarea
                value={description}
                autosize
                minRows={2}
                onChange={(event) => setDescription(event.target.value)}
              />
            </FormField>

            <Inline justify="end">
              <Button
                type="submit"
                variant="solid"
                disabled={createProject.isPending || name.trim() === ''}
              >
                {createProject.isPending ? 'Creating...' : 'Create project'}
              </Button>
            </Inline>
          </Stack>
        </CardBody>
      </Card>

      {error ? <Alert tone="error">{error.message}</Alert> : null}

      {!isPending && projects && projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Projects are optional: tasks can live without one."
        />
      ) : (
        <Stack gap={2}>
          {(projects ?? []).map((project) => (
            <Card key={project.id}>
              <CardBody>
                <Inline gap={3} align="center" justify="between">
                  <Stack gap={1}>
                    <Inline gap={2} align="center">
                      <Text weight="bold">{project.name}</Text>
                      <Badge variant="outline">{project.openTaskCount} open</Badge>
                      {project.archivedAt ? <Badge variant="solid">archived</Badge> : null}
                    </Inline>
                    {project.description ? <Text size="sm">{project.description}</Text> : null}
                  </Stack>

                  <Button
                    variant="ghost"
                    onClick={() => setArchived(project.id, project.archivedAt == null)}
                  >
                    {project.archivedAt ? 'Restore' : 'Archive'}
                  </Button>
                </Inline>
              </CardBody>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
