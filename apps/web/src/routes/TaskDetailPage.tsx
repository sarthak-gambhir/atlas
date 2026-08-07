import {
  Badge,
  Button,
  Divider,
  EmptyState,
  Heading,
  Icon,
  Inline,
  Stack,
  Text,
} from '@astrabound/duality';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { BucketBadge } from '../components/BucketBadge.tsx';
import { IconLabel } from '../components/IconLabel.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { TaskModal } from '../components/TaskModal.tsx';
import { dueLabel } from '../lib/dates.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { CONFIDENCE_LABELS } from '../lib/labels.ts';
import { useProjects, useUsers } from '../lib/organization.ts';
import { useTask } from '../lib/tasks.ts';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: task, isPending, error } = useTask(id);
  // Include archived so an archived project's name still resolves here.
  const { data: projects } = useProjects(true);
  const { data: users } = useUsers();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const backLink = (
    <Link to="/" className="atlas-card-link">
      <Inline gap={1} align="center">
        <Icon icon={ACTION_ICONS.back} />
        <Text size="sm">Backlog</Text>
      </Inline>
    </Link>
  );

  if (!task) {
    return (
      <Stack gap={4}>
        {backLink}
        {isPending && !error ? (
          <Text>Loading task...</Text>
        ) : (
          <EmptyState
            icon={<Icon icon={ACTION_ICONS.warning} size={64} />}
            title="Task not found"
            description="It may have been deleted, or you don't have access to it."
            action={
              <Link to="/" className="atlas-card-link">
                <Button className="atlas-button" size="md" variant="solid">
                  <IconLabel icon={ACTION_ICONS.back}>Back to backlog</IconLabel>
                </Button>
              </Link>
            }
          />
        )}
      </Stack>
    );
  }

  const project = task.projectId ? projects?.find((p) => p.id === task.projectId) : undefined;
  const assignee = task.assigneeId ? users?.find((u) => u.id === task.assigneeId) : undefined;
  const dates = dueLabel(task);

  return (
    <Stack gap={4}>
      <Inline gap={3} align="center" justify="between" wrap>
        {backLink}
        <Button variant="solid" onClick={() => setEditing(true)}>
          <IconLabel icon={ACTION_ICONS.edit}>Edit</IconLabel>
        </Button>
      </Inline>

      <Stack gap={2}>
        <Heading level={1} visualLevel={3}>
          {task.title}
        </Heading>
        <Inline gap={2} align="center">
          <Badge variant="solid">{task.score}</Badge>
          <BucketBadge bucket={task.bucket} />
          <StatusBadge status={task.status} />
        </Inline>
      </Stack>

      <Divider />

      <Stack gap={3}>
        <Field label="Project">
          {project ? (
            <Link to={`/projects/${project.id}`} className="atlas-card-link">
              <Text>{project.name}</Text>
            </Link>
          ) : (
            <Text>No project</Text>
          )}
        </Field>

        <Field label="Assignee">
          <Text>{assignee ? assignee.displayName : 'Unassigned'}</Text>
        </Field>

        <Field label="Impact">
          <Text>{task.impact}</Text>
        </Field>

        <Field label="Effort">
          <Text>{task.effort}</Text>
        </Field>

        <Field label="Confidence">
          <Text>{CONFIDENCE_LABELS[String(task.confidence)] ?? String(task.confidence)}</Text>
        </Field>

        <Field label="Dates">
          {task.dueStartDate || task.dueEndDate ? (
            <Stack gap={1}>
              <Text>Start: {task.dueStartDate ?? '—'}</Text>
              <Text>Due: {task.dueEndDate ?? '—'}</Text>
              {dates.date && dates.phrase !== dates.date ? (
                <Text size="sm">
                  {dates.prefix} {dates.phrase}
                </Text>
              ) : null}
              {dates.lateStart ? (
                <Badge size="sm" variant="outline">
                  Should have started
                </Badge>
              ) : null}
            </Stack>
          ) : (
            <Text>No dates</Text>
          )}
        </Field>

        <Field label="Tags">
          {task.tags.length > 0 ? (
            <Inline gap={1} wrap>
              {task.tags.map((tag) => (
                <Badge key={tag} variant="outline" size="sm">
                  {tag}
                </Badge>
              ))}
            </Inline>
          ) : (
            <Text>None</Text>
          )}
        </Field>

        <Field label="Notes">
          {task.notes ? (
            <Text style={{ whiteSpace: 'pre-wrap' }}>{task.notes}</Text>
          ) : (
            <Text>No notes</Text>
          )}
        </Field>
      </Stack>

      <Divider />

      <Text size="sm">
        Created {new Date(task.createdAt).toLocaleDateString()}
        {task.completedAt ? `, completed ${new Date(task.completedAt).toLocaleDateString()}` : ''}
      </Text>

      {editing ? (
        <TaskModal
          key={task.id}
          task={task}
          onClose={() => setEditing(false)}
          onDeleted={() => void navigate('/')}
        />
      ) : null}
    </Stack>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <Inline gap={3} align="start">
      <Text size="sm" weight="bold" style={{ inlineSize: '8rem', flexShrink: 0 }}>
        {label}
      </Text>
      {children}
    </Inline>
  );
}
