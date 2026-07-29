import {
  Badge,
  Button,
  DatePicker,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  FormField,
  Heading,
  Inline,
  Input,
  NumberInput,
  Select,
  Stack,
  TagInput,
  Text,
  Textarea,
  useToast,
} from '@astrabound/duality';
import {
  CONFIDENCE_VALUES,
  TASK_STATUSES,
  bucketFor,
  computeScore,
  toConfidence,
  type TaskDto,
  type TaskStatus,
} from '@atlas/shared';
import { useState } from 'react';

import { formatIsoDate, parseIsoDate, todayIso } from '../lib/dates.ts';
import { CONFIDENCE_LABELS, STATUS_LABELS } from '../lib/labels.ts';
import { useProjects, useUsers } from '../lib/organization.ts';
import { useDeleteTask, useScoringSettings, useUpdateTask } from '../lib/tasks.ts';

interface TaskDrawerProps {
  task: TaskDto;
  onClose: () => void;
}

/** Mount with `key={task.id}` so switching tasks resets the draft. */
export function TaskDrawer({ task, onClose }: TaskDrawerProps) {
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const { data: scoring } = useScoringSettings();
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { toast } = useToast();

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [impact, setImpact] = useState(task.impact);
  const [effort, setEffort] = useState(task.effort);
  const [confidence, setConfidence] = useState(toConfidence(task.confidence));
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [tags, setTags] = useState(task.tags);
  const [projectId, setProjectId] = useState(task.projectId ?? '');
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const preview = computeScore(
    { impact, effort, confidence, dueDate, urgencyOverride: task.urgencyOverride },
    scoring,
    todayIso(),
  );

  const save = () => {
    update.mutate(
      {
        id: task.id,
        title,
        notes: notes.trim() === '' ? null : notes,
        status,
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
          toast({ title: 'Task saved', tone: 'success' });
          onClose();
        },
        onError: (error) => toast({ title: 'Could not save', description: error.message, tone: 'error' }),
      },
    );
  };

  const destroy = () => {
    remove.mutate(task.id, {
      onSuccess: () => {
        toast({ title: 'Task deleted' });
        onClose();
      },
      onError: (error) =>
        toast({ title: 'Could not delete', description: error.message, tone: 'error' }),
    });
  };

  return (
    <Drawer isOpen onClose={onClose} side="end" size="md" showCloseButton aria-label="Task details">
      <DrawerHeader>
        <Inline gap={3} align="center" justify="between">
          <Heading level={2} visualLevel={4}>
            Task
          </Heading>
          <Inline gap={2} align="center">
            <Badge variant="solid">{preview}</Badge>
            <Badge variant="outline">{bucketFor(preview, scoring.thresholds)}</Badge>
          </Inline>
        </Inline>
      </DrawerHeader>

      <DrawerBody>
        <Stack gap={4}>
          <FormField label="Title" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </FormField>

          <FormField label="Notes">
            <Textarea
              value={notes}
              autosize
              minRows={3}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <FormField label="Status">
            <Select
              value={status}
              options={TASK_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
              onValueChange={(value) => setStatus(value as TaskStatus)}
            />
          </FormField>

          <Inline gap={3} align="start">
            <FormField label="Project">
              <Select
                value={projectId}
                options={[
                  { value: '', label: 'No project' },
                  ...(projects ?? []).map((project) => ({
                    value: project.id,
                    label: project.name,
                  })),
                ]}
                onValueChange={setProjectId}
              />
            </FormField>

            <FormField label="Assignee">
              <Select
                value={assigneeId}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...(users ?? [])
                    .filter((user) => !user.disabled || user.id === assigneeId)
                    .map((user) => ({ value: user.id, label: user.displayName })),
                ]}
                onValueChange={setAssigneeId}
              />
            </FormField>
          </Inline>

          <Inline gap={3} align="start">
            <FormField label="Impact" hint="1 low, 5 high">
              <NumberInput value={impact} min={1} max={5} onValueChange={(v) => setImpact(v ?? 1)} />
            </FormField>

            <FormField label="Effort" hint="1 cheap, 5 costly">
              <NumberInput value={effort} min={1} max={5} onValueChange={(v) => setEffort(v ?? 1)} />
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

          <Text size="sm">
            Created {new Date(task.createdAt).toLocaleDateString()}
            {task.completedAt ? `, completed ${new Date(task.completedAt).toLocaleDateString()}` : ''}
          </Text>
        </Stack>
      </DrawerBody>

      <DrawerFooter>
        <Inline gap={2} align="center" justify="between">
          {confirmingDelete ? (
            <Inline gap={2} align="center">
              <Button variant="solid" onClick={destroy} disabled={remove.isPending}>
                Confirm delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Keep
              </Button>
            </Inline>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}

          <Inline gap={2} align="center">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="solid" onClick={save} disabled={update.isPending || title.trim() === ''}>
              {update.isPending ? 'Saving...' : 'Save'}
            </Button>
          </Inline>
        </Inline>
      </DrawerFooter>
    </Drawer>
  );
}
