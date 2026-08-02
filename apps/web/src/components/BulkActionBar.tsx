import {
  Badge,
  Button,
  Card,
  CardBody,
  Grid,
  Inline,
  Select,
  Stack,
  Text,
  useToast,
} from '@astrabound/duality';
import { TASK_STATUSES, type BulkUpdateInput, type TaskStatus } from '@atlas/shared';

import { STATUS_LABELS } from '../lib/labels.ts';
import { canEditProject, useProjects, useUsers } from '../lib/organization.ts';
import { useSession } from '../lib/session.ts';
import { useBulkUpdateTasks } from '../lib/tasks.ts';

interface BulkActionBarProps {
  ids: string[];
  onDone: () => void;
}

/**
 * Deliberately limited to the three fields that mean the same thing applied to
 * a whole selection. Impact, effort, confidence and due dates are per-task
 * judgements and are only editable one task at a time.
 */
export function BulkActionBar({ ids, onDone }: BulkActionBarProps) {
  const bulkUpdate = useBulkUpdateTasks();
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: session } = useSession();
  const { toast } = useToast();

  const apply = (patch: BulkUpdateInput['patch'], description: string) => {
    bulkUpdate.mutate(
      { ids, patch },
      {
        onSuccess: ({ updated, skipped, reasons }) => {
          const suffix =
            skipped > 0
              ? ` \u00b7 ${skipped} skipped${reasons.length > 0 ? ` (${reasons.join(', ')})` : ''}`
              : '';
          toast({
            title: `${description} for ${updated} task${updated === 1 ? '' : 's'}${suffix}`,
            tone: skipped > 0 && updated === 0 ? 'error' : 'success',
          });
          onDone();
        },
        onError: (cause) =>
          toast({ title: 'Bulk update failed', description: cause.message, tone: 'error' }),
      },
    );
  };

  // You can only move tasks into projects you can edit (owner/editor/admin).
  const openProjects = (projects ?? []).filter(
    (project) => project.archivedAt == null && canEditProject(project, session),
  );

  return (
    <Card>
      <CardBody>
        <Stack gap={3}>
          <Inline gap={2} align="center" justify="between" wrap>
            <Inline gap={2} align="center">
              <Badge variant="solid">{ids.length}</Badge>
              <Text size="sm">selected</Text>
            </Inline>

            <Button variant="ghost" onClick={onDone} disabled={bulkUpdate.isPending}>
              Clear selection
            </Button>
          </Inline>

          <Grid minChildWidth={200} gap={2}>
            <Select
              value=""
              aria-label="Set status for selection"
              placeholder="Set status"
              disabled={bulkUpdate.isPending}
              options={TASK_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
              onValueChange={(value) =>
                apply(
                  { status: value as TaskStatus },
                  `Status set to ${STATUS_LABELS[value as TaskStatus]}`,
                )
              }
            />

            <Select
              value=""
              aria-label="Set project for selection"
              placeholder="Set project"
              disabled={bulkUpdate.isPending}
              options={[
                { value: '', label: 'No project' },
                ...openProjects.map((project) => ({ value: project.id, label: project.name })),
              ]}
              onValueChange={(value) =>
                apply(
                  { projectId: value === '' ? null : value },
                  value === '' ? 'Project cleared' : 'Project set',
                )
              }
            />

            <Select
              value=""
              aria-label="Set assignee for selection"
              placeholder="Set assignee"
              disabled={bulkUpdate.isPending}
              options={[
                { value: '', label: 'Unassigned' },
                ...(users ?? [])
                  .filter((user) => !user.disabled)
                  .map((user) => ({ value: user.id, label: user.displayName })),
              ]}
              onValueChange={(value) =>
                apply(
                  { assigneeId: value === '' ? null : value },
                  value === '' ? 'Assignee cleared' : 'Assignee set',
                )
              }
            />
          </Grid>
        </Stack>
      </CardBody>
    </Card>
  );
}
