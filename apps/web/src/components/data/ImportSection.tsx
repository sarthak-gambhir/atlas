import {
  Alert,
  Button,
  ConfirmDialog,
  FileUpload,
  Heading,
  Inline,
  Select,
  Stack,
  Stat,
  StatGroup,
  Text,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
} from '@astrabound/duality';
import { backupBundleSchema, type BackupBundle, type ImportResultDto } from '@atlas/shared';
import { useMemo, useState } from 'react';

import { useImportBackup } from '../../lib/admin.ts';
import { useUsers } from '../../lib/organization.ts';

type Mode = 'merge' | 'replace';
type AssigneeChoice = 'unassigned' | 'map';

const UNASSIGNED = '';

export function ImportSection() {
  const importBackup = useImportBackup();
  const { data: users } = useUsers();
  const { toast } = useToast();

  const [files, setFiles] = useState<File[]>([]);
  const [bundle, setBundle] = useState<BackupBundle | null>(null);
  const [issues, setIssues] = useState<string[] | null>(null);
  const [mode, setMode] = useState<Mode>('merge');
  const [result, setResult] = useState<ImportResultDto | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assigneeChoice, setAssigneeChoice] = useState<AssigneeChoice>('unassigned');
  // Keyed by lower-cased bundle username -> chosen user id ('' = leave unassigned).
  const [assigneeMap, setAssigneeMap] = useState<Record<string, string>>({});

  const activeUsers = useMemo(() => (users ?? []).filter((user) => !user.disabled), [users]);
  const knownUsernames = useMemo(
    () => new Set((users ?? []).map((user) => user.username.toLowerCase())),
    [users],
  );

  // Distinct assignees in the bundle that have no matching user here. Displayed
  // with their original casing; mapped by the lower-cased key the server expects.
  const unknownAssignees = useMemo(() => {
    if (!bundle) return [];
    const seen = new Map<string, string>();
    for (const task of bundle.tasks) {
      const name = task.assignee?.trim();
      if (name && !knownUsernames.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [bundle, knownUsernames]);

  const resetAssignees = () => {
    setAssigneeChoice('unassigned');
    setAssigneeMap({});
  };

  const clearFile = () => {
    setFiles([]);
    setBundle(null);
    resetAssignees();
  };

  const onFiles = async (next: File[]) => {
    setFiles(next);
    setResult(null);
    setBundle(null);
    setIssues(null);
    resetAssignees();

    const file = next[0];
    if (!file) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setIssues(['That file is not valid JSON.']);
      return;
    }

    const validated = backupBundleSchema.safeParse(parsed);
    if (!validated.success) {
      setIssues(
        validated.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.') || 'file'}: ${issue.message}`),
      );
      return;
    }

    setBundle(validated.data);
  };

  const run = () => {
    if (!bundle) return;

    const effectiveMap =
      assigneeChoice === 'map'
        ? Object.fromEntries(
            Object.entries(assigneeMap).filter(([, id]) => id !== UNASSIGNED),
          )
        : undefined;

    importBackup.mutate(
      {
        mode,
        bundle,
        ...(effectiveMap && Object.keys(effectiveMap).length > 0
          ? { assigneeMap: effectiveMap }
          : {}),
      },
      {
        onSuccess: ({ result: outcome }) => {
          setResult(outcome);
          setConfirmOpen(false);
          clearFile();
          toast({ title: `Imported ${outcome.tasksCreated} tasks`, tone: 'success' });
        },
        onError: (cause) => {
          setConfirmOpen(false);
          setIssues([cause.message]);
        },
      },
    );
  };

  const startImport = () => {
    if (!bundle) return;
    if (mode === 'replace') {
      setConfirmOpen(true);
      return;
    }
    run();
  };

  const uniqueTags = bundle
    ? new Set(bundle.tasks.flatMap((task) => task.tags.map((tag) => tag.toLowerCase()))).size
    : 0;

  return (
    <Stack gap={3}>
      <Stack gap={1}>
        <Heading level={3} visualLevel={5}>
          Import
        </Heading>
        <Text size="sm">
          Load a previously exported Atlas file. You will see what is inside before anything changes.
        </Text>
      </Stack>

      <FileUpload
        accept="application/json,.json"
        value={files}
        label="Drop an Atlas export here or browse"
        disabled={importBackup.isPending}
        onValueChange={(next) => void onFiles(next)}
      />

      {issues ? (
        <Alert tone="error" title="That file could not be read">
          <Stack gap={1}>
            {issues.map((issue, index) => (
              <Text key={index} size="sm">
                {issue}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}

      {bundle ? (
        <Stack gap={3}>
          <Stack gap={2}>
            <Text size="sm">
              Format v{bundle.version}
              {bundle.exportedAt
                ? ` · exported ${new Date(bundle.exportedAt).toLocaleString()}`
                : ''}
              {` · scoring settings ${bundle.scoring ? 'included' : 'not included'}`}
            </Text>
            <StatGroup>
              <Stat label="Projects" value={bundle.projects.length} />
              <Stat label="Tasks" value={bundle.tasks.length} />
              <Stat label="Tags" value={uniqueTags} />
            </StatGroup>
          </Stack>

          <ToggleGroup
            type="single"
            label="On import"
            value={mode}
            onValueChange={(value) => {
              if (value === 'merge' || value === 'replace') setMode(value);
            }}
          >
            <ToggleGroupItem value="merge">Merge</ToggleGroupItem>
            <ToggleGroupItem value="replace">Replace</ToggleGroupItem>
          </ToggleGroup>

          <Text size="sm">
            {mode === 'merge'
              ? 'Adds these projects and tasks to what you already have.'
              : 'Deletes every existing task and project first. People and passwords are left alone.'}
          </Text>

          {unknownAssignees.length > 0 ? (
            <Stack gap={2}>
              <Text size="sm" weight="bold">
                {unknownAssignees.length} assignee
                {unknownAssignees.length === 1 ? '' : 's'} in this file{' '}
                {unknownAssignees.length === 1 ? 'does' : 'do'} not exist here
              </Text>

              <ToggleGroup
                type="single"
                label="Unknown assignees"
                value={assigneeChoice}
                onValueChange={(value) => {
                  if (value === 'unassigned' || value === 'map') setAssigneeChoice(value);
                }}
              >
                <ToggleGroupItem value="unassigned">Leave unassigned</ToggleGroupItem>
                <ToggleGroupItem value="map">Map to people</ToggleGroupItem>
              </ToggleGroup>

              {assigneeChoice === 'map' ? (
                <Stack gap={2}>
                  {unknownAssignees.map((name) => {
                    const key = name.toLowerCase();
                    return (
                      <Inline key={key} gap={3} align="center" justify="between">
                        <Text size="sm">@{name}</Text>
                        <Select
                          value={assigneeMap[key] ?? UNASSIGNED}
                          options={[
                            { value: UNASSIGNED, label: 'Leave unassigned' },
                            ...activeUsers.map((user) => ({
                              value: user.id,
                              label: `${user.displayName} (@${user.username})`,
                            })),
                          ]}
                          onValueChange={(value) =>
                            setAssigneeMap((prev) => ({ ...prev, [key]: value }))
                          }
                        />
                      </Inline>
                    );
                  })}
                </Stack>
              ) : (
                <Text size="sm">
                  These tasks will import without an assignee: {unknownAssignees.join(', ')}
                </Text>
              )}
            </Stack>
          ) : null}

          <Inline gap={2}>
            <Button variant="solid" disabled={importBackup.isPending} onClick={startImport}>
              {importBackup.isPending
                ? 'Importing...'
                : `Import ${bundle.tasks.length} task${bundle.tasks.length === 1 ? '' : 's'}`}
            </Button>
            <Button variant="ghost" disabled={importBackup.isPending} onClick={clearFile}>
              Cancel
            </Button>
          </Inline>
        </Stack>
      ) : null}

      {result ? (
        <Alert tone="success" title="Import complete">
          <Stack gap={1}>
            <Text size="sm">
              {result.tasksCreated} tasks, {result.projectsCreated} projects and {result.tagsCreated}{' '}
              tags added.
            </Text>
            {result.unknownAssignees.length > 0 ? (
              <Text size="sm">
                Left unassigned (no such user): {result.unknownAssignees.join(', ')}
              </Text>
            ) : null}
          </Stack>
        </Alert>
      ) : null}

      <ConfirmDialog
        isOpen={confirmOpen}
        tone="danger"
        title="Replace all data?"
        description="Replace deletes every existing task and project before importing. People and their passwords are left alone."
        confirmLabel="Replace"
        isLoading={importBackup.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={run}
      />
    </Stack>
  );
}
