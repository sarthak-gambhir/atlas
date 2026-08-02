import {
  Badge,
  Button,
  DatePicker,
  FormField,
  Heading,
  Inline,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  Select,
  Stack,
  TagInput,
  useToast,
} from '@astrabound/duality';
import {
  CONFIDENCE_VALUES,
  bucketFor,
  computeScore,
  toConfidence,
  type Confidence,
  type ProjectDto,
} from '@atlas/shared';
import { useState, type FormEvent } from 'react';

import { BucketBadge } from './BucketBadge.tsx';
import { formatIsoDate, parseIsoDate, todayIso } from '../lib/dates.ts';
import { CONFIDENCE_LABELS } from '../lib/labels.ts';
import { canEditProject, useProjects, useUsers } from '../lib/organization.ts';
import { useSession } from '../lib/session.ts';
import { useCreateTask, useScoringSettings } from '../lib/tasks.ts';

interface QuickAddModalProps {
  onClose: () => void;
  /** Pre-selects a project and seeds the form from its defaults. */
  initialProjectId?: string;
}

interface Seed {
  assigneeId: string;
  impact: number;
  effort: number;
  confidence: Confidence;
  tags: string[];
}

/** Base values plus whatever the chosen project overrides. */
function seedFor(projects: ProjectDto[] | undefined, projectId: string): Seed {
  const defaults = projects?.find((project) => project.id === projectId)?.defaults;
  return {
    assigneeId: defaults?.assigneeId ?? '',
    impact: defaults?.impact ?? 3,
    effort: defaults?.effort ?? 3,
    confidence: defaults?.confidence != null ? toConfidence(defaults.confidence) : 1,
    tags: defaults?.tags ?? [],
  };
}

/** Mount only while open so the initial project and its defaults stay live. */
export function QuickAddModal({ onClose, initialProjectId = '' }: QuickAddModalProps) {
  const create = useCreateTask();
  const { data: scoring } = useScoringSettings();
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: session } = useSession();
  const { toast } = useToast();

  // You can only create tasks in projects you can edit (owner/editor/admin).
  const editableProjects = (projects ?? []).filter(
    (project) => project.archivedAt == null && canEditProject(project, session),
  );

  // Ignore a pre-selected project that is archived, hidden or view-only.
  const initialProject = editableProjects.find((project) => project.id === initialProjectId);
  const safeInitialId = initialProject ? initialProjectId : '';
  const initial = seedFor(projects, safeInitialId);

  const [title, setTitle] = useState('');
  const [impact, setImpact] = useState(initial.impact);
  const [effort, setEffort] = useState(initial.effort);
  const [confidence, setConfidence] = useState<Confidence>(initial.confidence);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [projectId, setProjectId] = useState(safeInitialId);
  const [assigneeId, setAssigneeId] = useState(initial.assigneeId);

  // A project scopes the assignee list to its members; without one, anyone active.
  const selectedProject = projects?.find((project) => project.id === projectId);
  const memberIds = selectedProject ? new Set(selectedProject.memberIds) : null;
  const assigneeOptions = [
    { value: '', label: 'Unassigned' },
    ...(users ?? [])
      .filter((user) => (memberIds ? memberIds.has(user.id) : !user.disabled) || user.id === assigneeId)
      .map((user) => ({ value: user.id, label: user.displayName })),
  ];

  // Switching projects re-seeds the scoring fields, tags and assignee from that
  // project's defaults, so a project acts as a task template.
  const applyProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    const seed = seedFor(projects, nextProjectId);
    setImpact(seed.impact);
    setEffort(seed.effort);
    setConfidence(seed.confidence);
    setTags(seed.tags);
    setAssigneeId(seed.assigneeId);
  };

  const preview = computeScore(
    { impact, effort, confidence, dueDate, urgencyOverride: null },
    scoring,
    todayIso(),
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(
      {
        title,
        impact,
        effort,
        confidence,
        dueDate,
        tags,
        projectId: projectId === '' ? null : projectId,
        assigneeId: assigneeId === '' ? null : assigneeId,
      },
      {
        onSuccess: () => {
          toast({ title: 'Task added', tone: 'success' });
          onClose();
        },
        onError: (error) =>
          toast({ title: 'Could not add task', description: error.message, tone: 'error' }),
      },
    );
  };

  return (
    <Modal isOpen onClose={onClose} size="md" showCloseButton aria-label="New task">
      <form onSubmit={submit}>
        <ModalHeader>
          <Inline gap={3} align="center" justify="between">
            <Heading level={2} visualLevel={4}>
              New task
            </Heading>
            <Inline gap={2} align="center">
              <Badge variant="solid">{preview}</Badge>
              <BucketBadge bucket={bucketFor(preview, scoring.thresholds)} />
            </Inline>
          </Inline>
        </ModalHeader>

        <ModalBody>
          <Stack gap={4}>
            <FormField label="Title" required>
              <Input
                value={title}
                autoFocus
                placeholder="What needs doing?"
                onChange={(event) => setTitle(event.target.value)}
              />
            </FormField>

            <Inline gap={3} align="start">
              <FormField label="Impact" hint="1 low, 5 high">
                <NumberInput
                  value={impact}
                  min={1}
                  max={5}
                  onValueChange={(value) => setImpact(value ?? 1)}
                />
              </FormField>

              <FormField label="Effort" hint="1 cheap, 5 costly">
                <NumberInput
                  value={effort}
                  min={1}
                  max={5}
                  onValueChange={(value) => setEffort(value ?? 1)}
                />
              </FormField>
            </Inline>

            <Inline gap={3} align="start">
              <FormField label="Project">
                <Select
                  value={projectId}
                  options={[
                    { value: '', label: 'No project' },
                    ...editableProjects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    })),
                  ]}
                  onValueChange={applyProject}
                />
              </FormField>

              <FormField label="Assignee">
                <Select value={assigneeId} options={assigneeOptions} onValueChange={setAssigneeId} />
              </FormField>
            </Inline>

            <FormField label="Confidence">
              <Select
                value={String(confidence)}
                options={CONFIDENCE_VALUES.map((value) => ({
                  value: String(value),
                  label: CONFIDENCE_LABELS[String(value)] ?? String(value),
                }))}
                onValueChange={(value) => setConfidence(toConfidence(Number(value)))}
              />
            </FormField>

            <FormField label="Due date">
              <DatePicker
                value={parseIsoDate(dueDate)}
                clearable
                placeholder="No due date"
                onValueChange={(value) => setDueDate(formatIsoDate(value))}
              />
            </FormField>

            <FormField label="Tags">
              <TagInput value={tags} onValueChange={setTags} placeholder="Add a tag" />
            </FormField>
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Inline gap={2} justify="end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="solid" disabled={create.isPending || title.trim() === ''}>
              {create.isPending ? 'Adding...' : 'Add task'}
            </Button>
          </Inline>
        </ModalFooter>
      </form>
    </Modal>
  );
}
