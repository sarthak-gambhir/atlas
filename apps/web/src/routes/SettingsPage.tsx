import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Code,
  DensitySelect,
  Divider,
  FormField,
  Grid,
  Heading,
  Inline,
  Input,
  NumberInput,
  PaletteSelect,
  Select,
  Slider,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  TextureSelect,
  useToast,
} from '@astrabound/duality';
import {
  CONFIDENCE_VALUES,
  DEFAULT_SCORING,
  USER_ROLES,
  backupBundleSchema,
  bucketFor,
  computeScore,
  type BucketThresholds,
  type PriorityBucket,
  type ScoreWeights,
  type ScoringSettings,
  type UserRole,
} from '@atlas/shared';
import { Fragment, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { RiArrowDownSFill } from 'react-icons/ri';

import {
  downloadBackup,
  useChangePassword,
  useCreateUser,
  useImportBackup,
  useSaveScoring,
  useUpdateUser,
} from '../lib/admin.ts';
import { BucketBadge } from '../components/BucketBadge.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { BUCKET_LABELS, CONFIDENCE_LABELS } from '../lib/labels.ts';
import { useUsers } from '../lib/organization.ts';
import { useSession } from '../lib/session.ts';
import { useScoringSettings } from '../lib/tasks.ts';

export function SettingsPage() {
  const { data: user } = useSession();
  const isAdmin = user?.role === 'admin';

  return (
    <Stack gap={5}>
      <PageHeader title="Settings" />

      <Card>
        <CardBody>
          <Tabs defaultValue="scoring">
            <TabList>
              <Tab value="scoring">Scoring</Tab>
              <Tab value="appearance">Appearance</Tab>
              <Tab value="account">Account</Tab>
              {isAdmin ? <Tab value="people">People</Tab> : null}
              {isAdmin ? <Tab value="data">Data</Tab> : null}
            </TabList>

            <TabPanel value="scoring">
              <ScoringCard canEdit={isAdmin} />
            </TabPanel>
            <TabPanel value="appearance">
              <AppearanceCard />
            </TabPanel>
            <TabPanel value="account">
              <PasswordCard />
            </TabPanel>
            {isAdmin ? (
              <TabPanel value="people">
                <UsersCard />
              </TabPanel>
            ) : null}
            {isAdmin ? (
              <TabPanel value="data">
                <DataCard />
              </TabPanel>
            ) : null}
          </Tabs>
        </CardBody>
      </Card>
    </Stack>
  );
}

function ScoringCard({ canEdit }: { canEdit: boolean }) {
  const { data: saved } = useScoringSettings();

  // The query renders the defaults first, so remount the form on the real
  // values rather than syncing them into state.
  return <ScoringForm key={JSON.stringify(saved)} saved={saved} canEdit={canEdit} />;
}

/**
 * The highest score reachable with these weights: impact and urgency both peak
 * at 5, confidence at 1 and effort at 1. Bounded to the schema's 0-50 range and
 * kept at least 1 so the axis never divides by zero.
 */
function axisMaxFor(weights: ScoreWeights): number {
  return Math.max(1, Math.min(50, 5 * (weights.impact + weights.urgency)));
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

  const [sample, setSample] = useState<SampleTask>({
    impact: 3,
    effort: 3,
    urgency: 3,
    confidence: 1,
  });

  const setThreshold = (bucket: keyof BucketThresholds, value: number) =>
    setDraft((previous) => ({
      ...previous,
      thresholds: { ...previous.thresholds, [bucket]: value },
    }));

  // Changing a weight can lower the reachable ceiling, so re-cap every
  // threshold to the new max. Clamping is monotonic, so the ordering holds.
  const setWeight = (key: keyof ScoreWeights, value: number) =>
    setDraft((previous) => {
      const weights = { ...previous.weights, [key]: value };
      const max = axisMaxFor(weights);
      return {
        weights,
        thresholds: {
          now: Math.min(previous.thresholds.now, max),
          next: Math.min(previous.thresholds.next, max),
          later: Math.min(previous.thresholds.later, max),
        },
      };
    });

  const setSampleField = (key: keyof SampleTask, value: number) =>
    setSample((previous) => ({ ...previous, [key]: value }));

  const axisMax = axisMaxFor(draft.weights);

  const sampleScore = computeScore(
    {
      impact: sample.impact,
      effort: sample.effort,
      confidence: sample.confidence,
      dueDate: null,
      urgencyOverride: sample.urgency,
    },
    draft,
  );
  const sampleBucket = bucketFor(sampleScore, draft.thresholds);

  return (
    <form onSubmit={submit}>
      <Stack gap={5}>
        <Stack gap={2}>
          <Heading level={3} visualLevel={4}>
            How the score works
          </Heading>
          <Code block>
            score = (impact × impact weight + urgency × urgency weight) × confidence ÷ effort
          </Code>
          <Text size="sm">
            Impact, effort and urgency each range 1 to 5; confidence is 50 to 100 percent. Scores
            round to one decimal.
          </Text>
        </Stack>

        <Divider />

        <Stack gap={3}>
          <Heading level={3} visualLevel={4}>
            Weights
          </Heading>
          <Text size="sm">
            Higher weights make that factor count for more. Impact rewards value; urgency rewards a
            nearing due date.
          </Text>
          <Grid minChildWidth={200} gap={3} style={{ maxWidth: 480 }}>
            <FormField label="Impact weight" disabled={!canEdit}>
              <NumberInput
                value={draft.weights.impact}
                min={0}
                max={10}
                step={0.5}
                onValueChange={(value) => setWeight('impact', value ?? 0)}
              />
            </FormField>

            <FormField label="Urgency weight" disabled={!canEdit}>
              <NumberInput
                value={draft.weights.urgency}
                min={0}
                max={10}
                step={0.5}
                onValueChange={(value) => setWeight('urgency', value ?? 0)}
              />
            </FormField>
          </Grid>
        </Stack>

        <Divider />

        <Stack gap={3}>
          <Heading level={3} visualLevel={4}>
            Bucket thresholds
          </Heading>
          <Text size="sm">
            A task lands in the highest bucket whose minimum score it meets. Each minimum is capped
            by its neighbour, so the buckets always stay in order.
          </Text>

          <BucketThresholdEditor
            thresholds={draft.thresholds}
            canEdit={canEdit}
            onChange={setThreshold}
            axisMax={axisMax}
          >
            <ScoringPlayground
              sample={sample}
              onChange={setSampleField}
              score={sampleScore}
              bucket={sampleBucket}
              thresholds={draft.thresholds}
              axisMax={axisMax}
            />
          </BucketThresholdEditor>
        </Stack>

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
    </form>
  );
}

/**
 * The now/next/later minimums as compact steppers. Each stepper is clamped by
 * its neighbours so the ordering (now >= next >= later) can never break. The
 * live score axis lives with the sample preview passed in as children.
 */
function BucketThresholdEditor({
  thresholds,
  canEdit,
  onChange,
  axisMax,
  children,
}: {
  thresholds: BucketThresholds;
  canEdit: boolean;
  onChange: (bucket: keyof BucketThresholds, value: number) => void;
  axisMax: number;
  children: ReactNode;
}) {
  const { now, next, later } = thresholds;
  const rows = [
    { bucket: 'now' as const, value: now, min: next, max: axisMax },
    { bucket: 'next' as const, value: next, min: later, max: now },
    { bucket: 'later' as const, value: later, min: 0, max: next },
  ];

  return (
    <Card>
      <CardBody>
        <Heading level={3} visualLevel={4}>
          Set bucket thresholds
        </Heading>
        <Stack gap={4}>
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: 'max-content 200px',
              columnGap: '2rem',
              rowGap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <Text size="sm" weight="bold">
              Bucket
            </Text>
            <Text size="sm" weight="bold">
              Minimum score
            </Text>

            {rows.map(({ bucket, value, min, max }) => (
              <Fragment key={bucket}>
                <BucketBadge bucket={bucket} />
                <NumberInput
                  aria-label={`${BUCKET_LABELS[bucket]} minimum score`}
                  value={value}
                  min={min}
                  max={max}
                  step={0.5}
                  disabled={!canEdit}
                  onValueChange={(update) => onChange(bucket, update ?? 0)}
                />
              </Fragment>
            ))}

            <BucketBadge bucket="someday" />
            <Text size="sm">no minimum</Text>
          </Box>

          <Divider />

          {children}
        </Stack>
      </CardBody>
    </Card>
  );
}

interface SampleTask {
  impact: number;
  effort: number;
  urgency: number;
  confidence: number;
}

/**
 * A horizontal score axis from 0 to the reachable max, split into the four
 * bucket bands. Each section is labelled beneath with its badge and the score
 * range it covers; the band holding the sample score gets the disabled-style
 * highlight, and a caret marks where the sample lands.
 */
function ScoreAxis({
  thresholds,
  max,
  marker,
}: {
  thresholds: BucketThresholds;
  max: number;
  marker: number;
}) {
  const { now, next, later } = thresholds;
  const pct = (value: number) => (Math.min(Math.max(value, 0), max) / max) * 100;

  const bands = [
    { bucket: 'someday' as const, from: 0, to: later },
    { bucket: 'later' as const, from: later, to: next },
    { bucket: 'next' as const, from: next, to: now },
    { bucket: 'now' as const, from: now, to: max },
  ];

  const markerPct = pct(marker);
  const activeBucket = bucketFor(marker, thresholds);

  // Duality's disabled treatment: a flat bg fill dithered with the theme
  // texture. Both derive from --fg / --bg, so it stays strictly two-colour.
  const highlight = {
    backgroundColor: 'var(--bg)',
    backgroundImage: 'var(--texture-image)',
    backgroundSize: 'var(--texture-size)',
    backgroundOrigin: 'border-box' as const,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ position: 'relative', height: 30 }}>
        <div
          style={{
            position: 'absolute',
            left: `${markerPct}%`,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
            transition: 'left 120ms ease',
          }}
        >
          <span style={{ fontSize: '1rem', fontWeight: 600 }}>{marker}</span>
          <RiArrowDownSFill aria-hidden />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 18,
          border: '1px solid currentColor',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {bands.map((band, index) => (
          <div
            key={band.bucket}
            style={{
              flex: `0 0 ${pct(band.to) - pct(band.from)}%`,
              minWidth: 0,
              borderLeft: index === 0 ? undefined : '1px solid currentColor',
              ...(band.bucket === activeBucket ? highlight : null),
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', width: '100%' }}>
        {bands.map((band) => (
          <div
            key={band.bucket}
            style={{
              flex: `0 0 ${pct(band.to) - pct(band.from)}%`,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <BucketBadge bucket={band.bucket} />
            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {band.from}–{band.to}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A throwaway task the admin can tweak to see how the current draft scores it. */
function ScoringPlayground({
  sample,
  onChange,
  score,
  bucket,
  thresholds,
  axisMax,
}: {
  sample: SampleTask;
  onChange: (key: keyof SampleTask, value: number) => void;
  score: number;
  bucket: PriorityBucket;
  thresholds: BucketThresholds;
  axisMax: number;
}) {
  const marks = [1, 2, 3, 4, 5];

  return (
    <Stack gap={3}>
      <Inline gap={3} align="center" justify="between">
        <Text weight="bold" size="sm">
          Preview with a sample task
        </Text>
        <Inline gap={2} align="center">
          <Badge variant="solid">{score}</Badge>
          <BucketBadge bucket={bucket} />
        </Inline>
      </Inline>

      <ScoreAxis thresholds={thresholds} max={axisMax} marker={score} />

      <Grid minChildWidth={220} gap={4}>
        <FormField label="Impact">
          <Slider
            value={sample.impact}
            min={1}
            max={5}
            step={1}
            marks={marks}
            showValue
            onValueChange={(value) => onChange('impact', value)}
          />
        </FormField>

        <FormField label="Effort">
          <Slider
            value={sample.effort}
            min={1}
            max={5}
            step={1}
            marks={marks}
            showValue
            onValueChange={(value) => onChange('effort', value)}
          />
        </FormField>

        <FormField label="Urgency">
          <Slider
            value={sample.urgency}
            min={1}
            max={5}
            step={1}
            marks={marks}
            showValue
            onValueChange={(value) => onChange('urgency', value)}
          />
        </FormField>

        <FormField label="Confidence">
          <Select
            value={String(sample.confidence)}
            options={CONFIDENCE_VALUES.map((value) => ({
              value: String(value),
              label: CONFIDENCE_LABELS[String(value)],
            }))}
            onValueChange={(value) => onChange('confidence', Number(value))}
          />
        </FormField>
      </Grid>
    </Stack>
  );
}

function AppearanceCard() {
  return (
    <Grid minChildWidth={200} gap={3}>
      <PaletteSelect />
      <DensitySelect />
      <TextureSelect />
    </Grid>
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
    <form onSubmit={submit}>
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
    </form>
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
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
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
    <Stack gap={4}>
      <Text size="sm">
        An export is a plain JSON file naming projects, tags and people rather than ids, so it can
        be restored into a fresh database. Passwords are never included.
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
  );
}
