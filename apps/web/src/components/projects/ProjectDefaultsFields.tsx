import { FormField, Grid, Select, Stack, TagInput, Text } from '@astrabound/duality';
import {
  CONFIDENCE_VALUES,
  toConfidence,
  type ProjectDefaultsDto,
  type ProjectDefaultsInput,
} from '@atlas/shared';

import { CONFIDENCE_LABELS } from '../../lib/labels.ts';
import { useUsers } from '../../lib/organization.ts';

/** Form-friendly shape: selects hold strings, `''` meaning "no default". */
export interface DefaultsDraft {
  assigneeId: string;
  impact: string;
  effort: string;
  confidence: string;
  tags: string[];
}

export const EMPTY_DEFAULTS: DefaultsDraft = {
  assigneeId: '',
  impact: '',
  effort: '',
  confidence: '',
  tags: [],
};

export function defaultsToDraft(defaults: ProjectDefaultsDto): DefaultsDraft {
  return {
    assigneeId: defaults.assigneeId ?? '',
    impact: defaults.impact != null ? String(defaults.impact) : '',
    effort: defaults.effort != null ? String(defaults.effort) : '',
    confidence: defaults.confidence != null ? String(defaults.confidence) : '',
    tags: defaults.tags,
  };
}

export function draftToDefaults(draft: DefaultsDraft): ProjectDefaultsInput {
  return {
    assigneeId: draft.assigneeId === '' ? null : draft.assigneeId,
    impact: draft.impact === '' ? null : Number(draft.impact),
    effort: draft.effort === '' ? null : Number(draft.effort),
    confidence: draft.confidence === '' ? null : toConfidence(Number(draft.confidence)),
    tags: draft.tags,
  };
}

const LEVEL_OPTIONS = [
  { value: '', label: 'No default' },
  ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
];

const CONFIDENCE_OPTIONS = [
  { value: '', label: 'No default' },
  ...CONFIDENCE_VALUES.map((value) => ({
    value: String(value),
    label: CONFIDENCE_LABELS[String(value)] ?? String(value),
  })),
];

interface ProjectDefaultsFieldsProps {
  value: DefaultsDraft;
  onChange: (next: DefaultsDraft) => void;
  /** A default assignee must be a project member; scope the options to them. */
  memberIds: string[];
}

/** The editable set of project defaults, shared by the form modal and detail page. */
export function ProjectDefaultsFields({ value, onChange, memberIds }: ProjectDefaultsFieldsProps) {
  const { data: users } = useUsers();
  const set = (patch: Partial<DefaultsDraft>) => onChange({ ...value, ...patch });
  const memberSet = new Set(memberIds);

  return (
    <Stack gap={3}>
      <Text size="sm">New tasks created in this project start from these values. All optional.</Text>

      <FormField label="Assignee">
        <Select
          value={value.assigneeId}
          options={[
            { value: '', label: 'No default' },
            ...(users ?? [])
              .filter(
                (user) =>
                  (memberSet.has(user.id) && !user.disabled) || user.id === value.assigneeId,
              )
              .map((user) => ({ value: user.id, label: user.displayName })),
          ]}
          onValueChange={(assigneeId) => set({ assigneeId })}
        />
      </FormField>

      <Grid minChildWidth={140} gap={3}>
        <FormField label="Impact">
          <Select value={value.impact} options={LEVEL_OPTIONS} onValueChange={(impact) => set({ impact })} />
        </FormField>
        <FormField label="Effort">
          <Select value={value.effort} options={LEVEL_OPTIONS} onValueChange={(effort) => set({ effort })} />
        </FormField>
        <FormField label="Confidence">
          <Select
            value={value.confidence}
            options={CONFIDENCE_OPTIONS}
            onValueChange={(confidence) => set({ confidence })}
          />
        </FormField>
      </Grid>

      <FormField label="Tags">
        <TagInput value={value.tags} onValueChange={(tags) => set({ tags })} placeholder="Add a tag" />
      </FormField>
    </Stack>
  );
}
