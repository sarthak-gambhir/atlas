import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Heading,
  Icon,
  Inline,
  Stack,
  Stat,
  StatGroup,
  Text,
} from '@astrabound/duality';
import { CLOSED_STATUSES, relevantDue, urgencyFor } from '@atlas/shared';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { BackLink } from '../components/BackLink.tsx';
import { BucketBadge } from '../components/BucketBadge.tsx';
import { IconLabel } from '../components/IconLabel.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { TagBadge } from '../components/TagBadge.tsx';
import { TaskModal } from '../components/TaskModal.tsx';
import { dueLabel, todayIso } from '../lib/dates.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { CONFIDENCE_LABELS } from '../lib/labels.ts';
import { useProjects, useUsers } from '../lib/organization.ts';
import { ProjectIcon } from '../lib/projectIcons.tsx';
import { useTask } from '../lib/tasks.ts';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: task, isPending, error } = useTask(id);
  // Include archived so an archived project's name still resolves here.
  const { data: projects } = useProjects(true);
  const { data: users } = useUsers();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  const backFallback = { label: 'Tasks', to: '/' };

  if (!task) {
    return (
      <Stack gap={4}>
        <BackLink fallback={backFallback} />
        {isPending && !error ? (
          <Text>Loading task...</Text>
        ) : (
          <EmptyState
            icon={<Icon icon={ACTION_ICONS.warning} size={64} />}
            title="Task not found"
            description="It may have been deleted, or you don't have access to it."
            action={<BackLink fallback={backFallback} variant="button" />}
          />
        )}
      </Stack>
    );
  }

  const project = task.projectId ? projects?.find((p) => p.id === task.projectId) : undefined;
  const assignee = task.assigneeId ? users?.find((u) => u.id === task.assigneeId) : undefined;
  const dates = dueLabel(task);

  // Mirror computeScore: closed tasks freeze urgency at their completion date, so
  // the stat matches the urgency that produced the (possibly frozen) score.
  const closed = (CLOSED_STATUSES as readonly string[]).includes(task.status);
  const completedDay = task.completedAt ? task.completedAt.slice(0, 10) : null;
  const urgency = urgencyFor(
    closed && completedDay == null
      ? null
      : relevantDue(task.status, task.dueStartDate, task.dueEndDate).date,
    task.urgencyOverride,
    (closed ? completedDay : todayIso()) ?? todayIso(),
  );

  return (
    <Stack gap={4}>
      <Inline gap={3} align="center" justify="between" wrap>
        <BackLink fallback={backFallback} />
        <Button className="atlas-button" size="md" variant="solid" onClick={() => setEditing(true)}>
          <IconLabel icon={ACTION_ICONS.edit}>Edit</IconLabel>
        </Button>
      </Inline>

      <Stack gap={2}>
        <Heading level={1} visualLevel={3}>
          {task.title}
        </Heading>
        <Inline gap={2} align="center" wrap>
          <BucketBadge bucket={task.bucket} />
          <StatusBadge status={task.status} />
        </Inline>
      </Stack>

      <StatGroup className="atlas-task-stats">
        <Stat label="Score" value={task.score} />
        <Stat label="Impact" value={task.impact} />
        <Stat label="Urgency" value={urgency} />
        <Stat label="Effort" value={task.effort} />
        <Stat
          label="Confidence"
          value={CONFIDENCE_LABELS[String(task.confidence)] ?? String(task.confidence)}
        />
      </StatGroup>

      <dl className="atlas-detail-facts">
        <Fact label="Project">
          {project ? (
            <Link to={`/projects/${project.id}`} className="atlas-card-link">
              <Inline gap={2} align="center">
                <ProjectIcon icon={project.icon} size="sm" />
                <Text>{project.name}</Text>
              </Inline>
            </Link>
          ) : (
            <Text>No project</Text>
          )}
        </Fact>

        <Fact label="Assignee">
          {assignee ? (
            <Inline gap={2} align="center">
              <Avatar name={assignee.displayName} size="sm" />
              <Text>{assignee.displayName}</Text>
            </Inline>
          ) : (
            <Text>Unassigned</Text>
          )}
        </Fact>

        <Fact label="Dates">
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
        </Fact>

        <Fact label="Tags">
          {task.tags.length > 0 ? (
            <Inline gap={1} wrap>
              {task.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </Inline>
          ) : (
            <Text>None</Text>
          )}
        </Fact>

        <Fact label="Created">
          <Text>
            {new Date(task.createdAt).toLocaleDateString()}
            {task.completedAt
              ? `, completed ${new Date(task.completedAt).toLocaleDateString()}`
              : ''}
          </Text>
        </Fact>
      </dl>

      <Card>
        <CardHeader>
          <Text weight="bold">Notes</Text>
        </CardHeader>
        <CardBody>
          {task.notes ? (
            <Text style={{ whiteSpace: 'pre-wrap' }}>{task.notes}</Text>
          ) : (
            <Text size="sm">No notes yet.</Text>
          )}
        </CardBody>
      </Card>

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

interface FactProps {
  label: string;
  children: ReactNode;
}

/** One label/value row of the facts sidebar; the parent `dl` grid aligns them. */
function Fact({ label, children }: FactProps) {
  return (
    <>
      <Text as="dt" size="sm" weight="bold">
        {label}
      </Text>
      <dd style={{ margin: 0 }}>{children}</dd>
    </>
  );
}
