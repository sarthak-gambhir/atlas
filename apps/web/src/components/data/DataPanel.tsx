import {
  Button,
  Code,
  Divider,
  Heading,
  Inline,
  Stack,
  Stat,
  StatGroup,
  Text,
  useToast,
} from '@astrabound/duality';
import { RiDownloadLine } from 'react-icons/ri';
import { useState } from 'react';

import { downloadBackup } from '../../lib/admin.ts';
import { useProjects, useTags, useUsers } from '../../lib/organization.ts';
import { useTasks } from '../../lib/tasks.ts';
import { DangerZone } from './DangerZone.tsx';
import { ImportSection } from './ImportSection.tsx';

function count(value: unknown[] | undefined): number | string {
  return value ? value.length : '—';
}

export function DataPanel() {
  const { toast } = useToast();
  const { data: tasks } = useTasks({ includeClosed: true });
  const { data: projects } = useProjects(true);
  const { data: tags } = useTags();
  const { data: users } = useUsers();

  const [savedAs, setSavedAs] = useState<string | null>(null);

  const onExport = () => {
    const filename = `atlas-${new Date().toISOString().slice(0, 10)}.json`;
    void downloadBackup()
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
            Downloads a plain JSON snapshot of projects, tasks, tags and scoring settings. Everything
            is named rather than referenced by id, so it can be restored into a fresh database.
            Passwords are never included.
          </Text>
        </Stack>

        <Inline gap={3} align="center">
          <Button variant="solid" onClick={onExport}>
            <Inline gap={2} align="center">
              <RiDownloadLine aria-hidden />
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
