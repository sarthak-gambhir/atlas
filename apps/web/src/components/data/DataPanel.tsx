import {
  Button,
  Code,
  Divider,
  FormField,
  Heading,
  Icon,
  Inline,
  MultiSelect,
  Stack,
  Stat,
  StatGroup,
  Text,
  useToast,
} from '@astrabound/duality';
import { useState } from 'react';

import { downloadBackup } from '../../lib/admin.ts';
import { ACTION_ICONS } from '../../lib/icons.ts';
import { useProjects, useTags, useUsers } from '../../lib/organization.ts';
import { useTasks } from '../../lib/tasks.ts';
import { DangerZone } from './DangerZone.tsx';
import { ImportSection } from './ImportSection.tsx';

function count(value: unknown[] | undefined): number | string {
  return value ? value.length : '—';
}

export function DataPanel() {
  const { toast } = useToast();
  const { data: tasks } = useTasks({ includeClosed: true, includeArchived: true });
  const { data: projects } = useProjects(true);
  const { data: tags } = useTags();
  const { data: users } = useUsers();

  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const projectOptions = (projects ?? []).map((project) => ({
    value: project.id,
    label: project.archivedAt ? `${project.name} (archived)` : project.name,
  }));

  const onExport = () => {
    const filename = `atlas-${new Date().toISOString().slice(0, 10)}.json`;
    void downloadBackup(selectedProjectIds)
      .then(() => setSavedAs(filename))
      .catch((cause: unknown) =>
        toast({
          title: 'Export failed',
          description: cause instanceof Error ? cause.message : 'Unknown error',
          tone: 'error',
        }),
      );
  };

  return (
    <Stack gap={5}>
      <StatGroup>
        <Stat label="Tasks" value={count(tasks)} />
        <Stat label="Projects" value={count(projects)} />
        <Stat label="Tags" value={count(tags)} />
        <Stat label="People" value={count(users)} />
      </StatGroup>

      <Divider />

      <Stack gap={3}>
        <Stack gap={1}>
          <Heading level={3} visualLevel={5}>
            Export
          </Heading>
          <Text size="sm">
            Downloads a plain JSON snapshot of projects, tasks, tags and scoring settings.
            Everything is named rather than referenced by id, so it can be restored into a fresh
            database. Passwords are never included.
          </Text>
        </Stack>

        <FormField
          label="Projects to export"
          hint="Leave empty to export everything. Selecting projects limits the export to them and their tasks."
        >
          <MultiSelect
            options={projectOptions}
            value={selectedProjectIds}
            onValueChange={setSelectedProjectIds}
            placeholder="All projects"
          />
        </FormField>

        <Inline gap={3} align="center">
          <Button className="atlas-button" variant="solid" size="md" onClick={onExport}>
            <Inline gap={2} align="center">
              <Icon icon={ACTION_ICONS.export} />
              Download export
            </Inline>
          </Button>
          {savedAs ? (
            <Text size="sm">
              Saved as <Code>{savedAs}</Code>
            </Text>
          ) : null}
        </Inline>
      </Stack>

      <Divider />

      <ImportSection />

      <Divider />

      <DangerZone />
    </Stack>
  );
}
