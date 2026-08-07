import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Code,
  Divider,
  FormField,
  Grid,
  Heading,
  Icon,
  Inline,
  NumberInput,
  Select,
  Slider,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  useToast,
} from '@astrabound/duality';
import {
  CONFIDENCE_VALUES,
  DEFAULT_SCORING,
  bucketFor,
  computeScore,
  type BucketThresholds,
  type PriorityBucket,
  type ScoreWeights,
  type ScoringSettings,
} from '@atlas/shared';
import { Fragment, useState, type FormEvent, type ReactNode } from 'react';

import { useSaveScoring } from '../lib/admin.ts';
import { AccountPanel } from '../components/account/AccountPanel.tsx';
import { AppearancePanel } from '../components/appearance/AppearancePanel.tsx';
import { BucketBadge } from '../components/BucketBadge.tsx';
import { DataPanel } from '../components/data/DataPanel.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { PeoplePanel } from '../components/people/PeoplePanel.tsx';
import { ACTION_ICONS } from '../lib/icons.ts';
import { BUCKET_LABELS, CONFIDENCE_LABELS } from '../lib/labels.ts';
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
              <AppearancePanel />
            </TabPanel>
            <TabPanel value="account">
              <AccountPanel />
            </TabPanel>
            {isAdmin ? (
              <TabPanel value="people">
                <PeoplePanel />
              </TabPanel>
            ) : null}
            {isAdmin ? (
              <TabPanel value="data">
                <DataPanel />
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
        ...previous,
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
      status: 'backlog',
      dueStartDate: null,
      dueEndDate: null,
      urgencyOverride: sample.urgency,
      completedAt: null,
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
            A bucket threshold is the minimum score a task must have to land in that bucket. A task
            will kept in the highest bucket whose minimum score it meets. Each threshold is capped
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
        <Heading level={4} visualLevel={5}>
          Set bucket minimum scores
        </Heading>
        <Stack gap={4}>
          <Box className="atlas-bucket-grid" paddingX={2} paddingY={4}>
            <Text size="sm" weight="bold">
              Bucket
            </Text>
            <Text size="sm" weight="bold">
              Minimum score
            </Text>

            {rows.map(({ bucket, value, min, max }) => (
              <Fragment key={bucket}>
                <BucketBadge bucket={bucket} size="lg" />
                <NumberInput
                  size="lg"
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

            <BucketBadge bucket="someday" size="lg" />
            <Text size="sm" weight="bold">
              -- No Minimum Score --
            </Text>
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
          <Icon icon={ACTION_ICONS.expand} />
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
        {/* Slider does not read FormField's context, so it needs the render prop
         * to receive the generated id that ties the label to the range input. */}
        <FormField label="Impact">
          {(field) => (
            <Slider
              {...field}
              value={sample.impact}
              min={1}
              max={5}
              step={1}
              marks={marks}
              showValue
              onValueChange={(value) => onChange('impact', value)}
            />
          )}
        </FormField>

        <FormField label="Urgency">
          {(field) => (
            <Slider
              {...field}
              value={sample.urgency}
              min={1}
              max={5}
              step={1}
              marks={marks}
              showValue
              onValueChange={(value) => onChange('urgency', value)}
            />
          )}
        </FormField>

        <FormField label="Effort">
          {(field) => (
            <Slider
              {...field}
              value={sample.effort}
              min={1}
              max={5}
              step={1}
              marks={marks}
              showValue
              onValueChange={(value) => onChange('effort', value)}
            />
          )}
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
