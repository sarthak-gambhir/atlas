import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DensitySelect,
  FormField,
  Grid,
  Heading,
  Inline,
  Input,
  NumberInput,
  PaletteSelect,
  Select,
  Stack,
  Text,
  TextureSelect,
  useToast,
} from '@astrabound/duality';
import {
  DEFAULT_SCORING,
  USER_ROLES,
  backupBundleSchema,
  type ScoringSettings,
  type UserRole,
} from '@atlas/shared';
import { useState, type ChangeEvent, type FormEvent } from 'react';

import {
  downloadBackup,
  useChangePassword,
  useCreateUser,
  useImportBackup,
  useSaveScoring,
  useUpdateUser,
} from '../lib/admin.ts';
import { PageHeader } from '../components/PageHeader.tsx';
import { useUsers } from '../lib/organization.ts';
import { useSession } from '../lib/session.ts';
import { useScoringSettings } from '../lib/tasks.ts';

export function SettingsPage() {
  const { data: user } = useSession();
  const isAdmin = user?.role === 'admin';

  return (
    <Stack gap={5}>
      <PageHeader title="Settings" />

      <ScoringCard canEdit={isAdmin} />
      <AppearanceCard />
      <PasswordCard />
      {isAdmin ? <UsersCard /> : null}
      {isAdmin ? <DataCard /> : null}
    </Stack>
  );
}

function ScoringCard({ canEdit }: { canEdit: boolean }) {
  const { data: saved } = useScoringSettings();

  // The query renders the defaults first, so remount the form on the real
  // values rather than syncing them into state.
  return <ScoringForm key={JSON.stringify(saved)} saved={saved} canEdit={canEdit} />;
}

function ScoringForm({ saved, canEdit }: { saved: ScoringSettings; canEdit: boolean }) {
  const save = useSaveScoring();
  const { toast } = useToast();
  const [draft, setDraft] = useState<ScoringSettings>(saved);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(draft, {
      onSuccess: () => toast({ title: 'Scoring updated', tone: 'success' }),
      onError: (cause) =>
        toast({ title: 'Could not save scoring', description: cause.message, tone: 'error' }),
    });
  };

  return (
    <Card as="form" onSubmit={submit}>
      <CardHeader>
        <Heading level={2} visualLevel={4}>
          Scoring
        </Heading>
      </CardHeader>
      <CardBody>
        <Stack gap={4}>
          <Text size="sm">
            score = (impact x impact weight + urgency x urgency weight) x confidence / effort
          </Text>

          <Grid minChildWidth={200} gap={3}>
            <FormField label="Impact weight" disabled={!canEdit}>
              <NumberInput
                value={draft.weights.impact}
                min={0}
                max={10}
                step={0.5}
                onValueChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    weights: { ...previous.weights, impact: value ?? 0 },
                  }))
                }
              />
            </FormField>

            <FormField label="Urgency weight" disabled={!canEdit}>
              <NumberInput
                value={draft.weights.urgency}
                min={0}
                max={10}
                step={0.5}
                onValueChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    weights: { ...previous.weights, urgency: value ?? 0 },
                  }))
                }
              />
            </FormField>
          </Grid>

          <Text weight="bold" size="sm">
            Bucket thresholds
          </Text>

          <Grid minChildWidth={160} gap={3}>
            {(['now', 'next', 'later'] as const).map((bucket) => (
              <FormField key={bucket} label={`At least ${bucket}`} disabled={!canEdit}>
                <NumberInput
                  value={draft.thresholds[bucket]}
                  min={0}
                  max={50}
                  step={0.5}
                  onValueChange={(value) =>
                    setDraft((previous) => ({
                      ...previous,
                      thresholds: { ...previous.thresholds, [bucket]: value ?? 0 },
                    }))
                  }
                />
              </FormField>
            ))}
          </Grid>

          {canEdit ? (
            <Inline gap={2} justify="end">
              <Button type="button" variant="ghost" onClick={() => setDraft(DEFAULT_SCORING)}>
                Reset to defaults
              </Button>
              <Button type="submit" variant="solid" disabled={save.isPending}>
                {save.isPending ? 'Saving...' : 'Save scoring'}
              </Button>
            </Inline>
          ) : (
            <Text size="sm">Only an admin can change the weights.</Text>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
}

function AppearanceCard() {
  return (
    <Card>
      <CardHeader>
        <Heading level={2} visualLevel={4}>
          Appearance
        </Heading>
      </CardHeader>
      <CardBody>
        <Grid minChildWidth={200} gap={3}>
          <PaletteSelect />
          <DensitySelect />
          <TextureSelect />
        </Grid>
      </CardBody>
    </Card>
  );
}

function PasswordCard() {
  const change = useChangePassword();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const mismatch = confirmation !== '' && confirmation !== newPassword;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast({ title: 'Password changed', description: 'Other devices were signed out.' });
          setCurrentPassword('');
          setNewPassword('');
          setConfirmation('');
        },
        onError: (cause) =>
          toast({ title: 'Could not change password', description: cause.message, tone: 'error' }),
      },
    );
  };

  return (
    <Card as="form" onSubmit={submit}>
      <CardHeader>
        <Heading level={2} visualLevel={4}>
          Your password
        </Heading>
      </CardHeader>
      <CardBody>
        <Stack gap={3}>
          <FormField label="Current password" required>
            <Input
              type="password"
              value={currentPassword}
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </FormField>

          <FormField label="New password" hint="At least 8 characters" required>
            <Input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </FormField>

          <FormField
            label="Confirm new password"
            error={mismatch ? 'The two passwords do not match.' : undefined}
            required
          >
            <Input
              type="password"
              value={confirmation}
              autoComplete="new-password"
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </FormField>

          <Inline justify="end">
            <Button
              type="submit"
              variant="solid"
              disabled={
                change.isPending ||
                mismatch ||
                currentPassword === '' ||
                newPassword.length < 8 ||
                confirmation === ''
              }
            >
              {change.isPending ? 'Changing...' : 'Change password'}
            </Button>
          </Inline>
        </Stack>
      </CardBody>
    </Card>
  );
}

function UsersCard() {
  const { data: users, error } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('member');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createUser.mutate(
      { username, displayName, password, role },
      {
        onSuccess: () => {
          toast({ title: `Created ${username}`, tone: 'success' });
          setUsername('');
          setDisplayName('');
          setPassword('');
          setRole('member');
        },
        onError: (cause) =>
          toast({ title: 'Could not create user', description: cause.message, tone: 'error' }),
      },
    );
  };

  const patch = (id: string, changes: { role?: UserRole; disabled?: boolean }) => {
    updateUser.mutate(
      { id, ...changes },
      {
        onSuccess: () => toast({ title: 'User updated' }),
        onError: (cause) =>
          toast({ title: 'Could not update user', description: cause.message, tone: 'error' }),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <Heading level={2} visualLevel={4}>
          People
        </Heading>
      </CardHeader>
      <CardBody>
        <Stack gap={4}>
          {error ? <Alert tone="error">{error.message}</Alert> : null}

          <Stack gap={2}>
            {(users ?? []).map((person) => (
              <Inline key={person.id} gap={3} align="center" justify="between">
                <Inline gap={2} align="center">
                  <Text weight="bold">{person.displayName}</Text>
                  <Text size="sm">{person.username}</Text>
                  <Badge variant="outline">{person.role}</Badge>
                  {person.disabled ? <Badge variant="solid">disabled</Badge> : null}
                </Inline>

                <Inline gap={2} align="center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patch(person.id, { role: person.role === 'admin' ? 'member' : 'admin' })
                    }
                  >
                    {person.role === 'admin' ? 'Make member' : 'Make admin'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => patch(person.id, { disabled: !person.disabled })}
                  >
                    {person.disabled ? 'Enable' : 'Disable'}
                  </Button>
                </Inline>
              </Inline>
            ))}
          </Stack>

          <form onSubmit={submit}>
            <Stack gap={3}>
              <Text weight="bold" size="sm">
                Add someone
              </Text>

              <Grid minChildWidth={200} gap={3}>
                <FormField label="Username" required>
                  <Input value={username} onChange={(event) => setUsername(event.target.value)} />
                </FormField>

                <FormField label="Display name" required>
                  <Input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                </FormField>

                <FormField label="Password" hint="At least 8 characters" required>
                  <Input
                    type="password"
                    value={password}
                    autoComplete="new-password"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </FormField>

                <FormField label="Role">
                  <Select
                    value={role}
                    options={USER_ROLES.map((value) => ({ value, label: value }))}
                    onValueChange={(value) => setRole(value as UserRole)}
                  />
                </FormField>
              </Grid>

              <Inline justify="end">
                <Button
                  type="submit"
                  variant="solid"
                  disabled={
                    createUser.isPending ||
                    username.trim() === '' ||
                    displayName.trim() === '' ||
                    password.length < 8
                  }
                >
                  {createUser.isPending ? 'Creating...' : 'Create user'}
                </Button>
              </Inline>
            </Stack>
          </form>
        </Stack>
      </CardBody>
    </Card>
  );
}

function DataCard() {
  const importBackup = useImportBackup();
  const { toast } = useToast();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [problem, setProblem] = useState<string | null>(null);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setProblem(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setProblem('That file is not valid JSON.');
      return;
    }

    const bundle = backupBundleSchema.safeParse(parsed);
    if (!bundle.success) {
      setProblem('That file is not an Atlas export.');
      return;
    }

    importBackup.mutate(
      { mode, bundle: bundle.data },
      {
        onSuccess: ({ result }) => {
          toast({
            title: `Imported ${result.tasksCreated} tasks`,
            description:
              result.unknownAssignees.length > 0
                ? `Unassigned, no such user: ${result.unknownAssignees.join(', ')}`
                : `${result.projectsCreated} projects, ${result.tagsCreated} tags`,
            tone: 'success',
            duration: 8000,
          });
        },
        onError: (cause) => setProblem(cause.message),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <Heading level={2} visualLevel={4}>
          Export and import
        </Heading>
      </CardHeader>
      <CardBody>
        <Stack gap={4}>
          <Text size="sm">
            An export is a plain JSON file naming projects, tags and people rather than ids, so it
            can be restored into a fresh database. Passwords are never included.
          </Text>

          {problem ? <Alert tone="error">{problem}</Alert> : null}

          <Grid minChildWidth={220} gap={3} align="end">
            <Button
              variant="solid"
              onClick={() => {
                void downloadBackup().catch((cause: unknown) =>
                  toast({
                    title: 'Export failed',
                    description: cause instanceof Error ? cause.message : 'Unknown error',
                    tone: 'error',
                  }),
                );
              }}
            >
              Download export
            </Button>

            <FormField label="On import">
              <Select
                value={mode}
                options={[
                  { value: 'merge', label: 'Merge into current data' },
                  { value: 'replace', label: 'Replace tasks and projects' },
                ]}
                onValueChange={(value) => setMode(value as 'merge' | 'replace')}
              />
            </FormField>

            <FormField label="Bundle file">
              <Input
                type="file"
                accept="application/json,.json"
                disabled={importBackup.isPending}
                onChange={(event) => void onFile(event)}
              />
            </FormField>
          </Grid>

          {mode === 'replace' ? (
            <Alert tone="warning">
              Replace deletes every existing task and project before importing. People and their
              passwords are left alone.
            </Alert>
          ) : null}
        </Stack>
      </CardBody>
    </Card>
  );
}
