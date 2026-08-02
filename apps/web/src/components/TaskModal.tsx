import {
  Alert,
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

import { BucketBadge } from './BucketBadge.tsx';
import { formatIsoDate, parseIsoDate, todayIso } from '../lib/dates.ts';
import { CONFIDENCE_LABELS, STATUS_LABELS } from '../lib/labels.ts';
import { canEditProject, useProjects, useUsers } from '../lib/organization.ts';
import { useSession } from '../lib/session.ts';
import { useDeleteTask, useScoringSettings, useUpdateTask } from '../lib/tasks.ts';

interface TaskModalProps {
  task: TaskDto;
  onClose: () => void;
  /** Called instead of `onClose` after a successful delete (e.g. to navigate away). */
  onDeleted?: () => void;
}

/** Mount with `key={task.id}` so switching tasks resets the draft. */
export function TaskModal({ task, onClose, onDeleted }: TaskModalProps) {
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const { data: scoring } = useScoringSettings();
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: session } = useSession();
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

  // A task whose project is missing from the (scoped, non-archived) list lives
  // in an archived project, so it is read-only until the project is restored.
  const inArchivedProject =
    projects != null && task.projectId != null && !projects.some((p) => p.id === task.projectId);
  // The task's live project where the viewer is only a viewer: read-only.
  const taskProject = projects?.find((p) => p.id === task.projectId);
  const viewOnlyProject =
    !inArchivedProject && taskProject != null && !canEditProject(taskProject, session);
  // An archived-status task in a live project can only be restored.
  const isArchivedTask = task.status === 'archived' && !inArchivedProject;
  const locked = inArchivedProject || isArchivedTask || viewOnlyProject;
  // A view-only project offers no actions, like an archived one.
  const actionsHidden = inArchivedProject || viewOnlyProject;

  // A project scopes the assignee list to its members; without one, anyone active.
  const selectedProject = projects?.find((project) => project.id === projectId);
  const memberIds = selectedProject ? new Set(selectedProject.memberIds) : null;
  const assigneeOptions = [
    { value: '', label: 'Unassigned' },
    ...(users ?? [])
      .filter((user) => (memberIds ? memberIds.has(user.id) : !user.disabled) || user.id === assigneeId)
      .map((user) => ({ value: user.id, label: user.displayName })),
  ];

  // Changing project keeps the assignee valid: drop it if not a member of the new one.
  const changeProject = (next: string) => {
    setProjectId(next);
    const project = projects?.find((candidate) => candidate.id === next);
    if (next !== '' && project && assigneeId !== '' && !project.memberIds.includes(assigneeId)) {
      setAssigneeId('');
    }
  };

  const restore = () => {
    update.mutate(
      { id: task.id, status: 'backlog' },
      {
        onSuccess: () => {
          toast({ title: 'Task restored', tone: 'success' });
          onClose();
        },
        onError: (error) =>
          toast({ title: 'Could not restore', description: error.message, tone: 'error' }),
      },
    );
  };

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
        if (onDeleted) onDeleted();
        else onClose();
      },
      onError: (error) =>
        toast({ title: 'Could not delete', description: error.message, tone: 'error' }),
    });
  };

  return (
    <Modal isOpen onClose={onClose} size="lg" showCloseButton aria-label="Task details">
      <ModalHeader>
        <Inline gap={3} align="center" justify="between">
          <Heading level={2} visualLevel={4}>
            Task
          </Heading>
          <Inline gap={2} align="center">
            <Badge variant="solid">{preview}</Badge>
            <BucketBadge bucket={bucketFor(preview, scoring.thresholds)} />
          </Inline>
        </Inline>
      </ModalHeader>

      <ModalBody>
        <Stack gap={4}>
          {inArchivedProject ? (
            <Alert tone="info">This task is in an archived project. Restore the project to edit it.</Alert>
          ) : viewOnlyProject ? (
            <Alert tone="info">You have view-only access to this task&rsquo;s project.</Alert>
          ) : isArchivedTask ? (
            <Alert tone="info">This task is archived. Restore it to move it back to the backlog.</Alert>
          ) : null}

          <FormField label="Title" required>
            <Input
              value={title}
              disabled={locked}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>

          <FormField label="Notes">
            <Textarea
              value={notes}
              autosize
              minRows={3}
              disabled={locked}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>

          <FormField label="Status">
            <Select
              value={status}
              disabled={locked}
              options={TASK_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
              onValueChange={(value) => setStatus(value as TaskStatus)}
            />
          </FormField>

          <Inline gap={3} align="start">
            <FormField label="Project">
              <Select
                value={projectId}
                disabled={locked}
                options={[
                  { value: '', label: 'No project' },
                  ...(projects ?? [])
                    .filter((project) => canEditProject(project, session) || project.id === projectId)
                    .map((project) => ({
                      value: project.id,
                      label: project.name,
                    })),
                ]}
                onValueChange={changeProject}
              />
            </FormField>

            <FormField label="Assignee">
              <Select
                value={assigneeId}
                disabled={locked}
                options={assigneeOptions}
                onValueChange={setAssigneeId}
              />
            </FormField>
          </Inline>

          <Inline gap={3} align="start">
            <FormField label="Impact" hint="1 low, 5 high">
              <NumberInput
                value={impact}
                min={1}
                max={5}
                disabled={locked}
                onValueChange={(v) => setImpact(v ?? 1)}
              />
            </FormField>

            <FormField label="Effort" hint="1 cheap, 5 costly">
              <NumberInput
                value={effort}
                min={1}
                max={5}
                disabled={locked}
                onValueChange={(v) => setEffort(v ?? 1)}
              />
            </FormField>
          </Inline>

          <FormField label="Confidence">
            <Select
              value={String(confidence)}
              disabled={locked}
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
              disabled={locked}
              placeholder="No due date"
              onValueChange={(value) => setDueDate(formatIsoDate(value))}
            />
          </FormField>

          <FormField label="Tags">
            <TagInput
              value={tags}
              disabled={locked}
              onValueChange={setTags}
              placeholder="Add a tag"
            />
          </FormField>

          <Text size="sm">
            Created {new Date(task.createdAt).toLocaleDateString()}
            {task.completedAt ? `, completed ${new Date(task.completedAt).toLocaleDateString()}` : ''}
          </Text>
        </Stack>
      </ModalBody>

      <ModalFooter>
        {actionsHidden ? (
          <Inline gap={2} justify="end" style={{ inlineSize: '100%' }}>
            <Button variant="solid" onClick={onClose}>
              Close
            </Button>
          </Inline>
        ) : (
          <Inline gap={2} align="center" justify="between" style={{ inlineSize: '100%' }}>
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
              {isArchivedTask ? (
                <Button variant="solid" onClick={restore} disabled={update.isPending}>
                  {update.isPending ? 'Restoring...' : 'Restore'}
                </Button>
              ) : (
                <Button
                  variant="solid"
                  onClick={save}
                  disabled={update.isPending || title.trim() === ''}
                >
                  {update.isPending ? 'Saving...' : 'Save'}
                </Button>
              )}
            </Inline>
          </Inline>
        )}
      </ModalFooter>
    </Modal>
  );
}
