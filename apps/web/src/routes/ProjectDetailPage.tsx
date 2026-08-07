import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Heading,
  Icon,
  Inline,
  Stack,
  Stat,
  StatGroup,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
} from '@astrabound/duality';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { IconLabel } from '../components/IconLabel.tsx';
import { TaskTable } from '../components/TaskTable.tsx';
import { FavoriteButton } from '../components/projects/FavoriteButton.tsx';
import { ProjectFormModal } from '../components/projects/ProjectFormModal.tsx';
import { ProjectMembers } from '../components/projects/ProjectMembers.tsx';
import { ProjectRowActions } from '../components/projects/ProjectRowActions.tsx';
import { ACTION_ICONS } from '../lib/icons.ts';
import { canEditProject, canManageProject, useProject, useProjects } from '../lib/organization.ts';
import { ProjectIcon } from '../lib/projectIcons.tsx';
import { useQuickAdd } from '../lib/quick-add.ts';
import { useSession } from '../lib/session.ts';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isPending, error } = useProject(id);
  // Warm the project list so a pre-scoped quick-add can read this project's
  // defaults immediately, even on a cold direct load of this page.
  useProjects();
  const { data: session } = useSession();
  const navigate = useNavigate();
  const openQuickAdd = useQuickAdd();
  const [editing, setEditing] = useState(false);

  const backLink = (
    <Link to="/projects" className="atlas-card-link">
      <Inline gap={1} align="center">
        <Icon icon={ACTION_ICONS.back} />
        <Text size="sm">Projects</Text>
      </Inline>
    </Link>
  );

  if (error) {
    return (
      <Stack gap={4}>
        {backLink}
        <Alert tone="error">{error.message}</Alert>
      </Stack>
    );
  }

  if (!project) {
    return (
      <Stack gap={4}>
        {backLink}
        {isPending ? (
          <Text>Loading project...</Text>
        ) : (
          <EmptyState
            icon={<Icon icon={ACTION_ICONS.warning} size="lg" />}
            title="Project not found"
            description="It may have been deleted."
            action={
              <Link to="/projects" className="atlas-card-link">
                <Button variant="solid">
                  <IconLabel icon={ACTION_ICONS.back}>Back to projects</IconLabel>
                </Button>
              </Link>
            }
          />
        )}
      </Stack>
    );
  }

  const { openTaskCount, doneTaskCount, totalTaskCount } = project;
  const percent = totalTaskCount > 0 ? Math.round((doneTaskCount / totalTaskCount) * 100) : 0;
  const archived = project.archivedAt != null;
  const canManage = canManageProject(project, session);
  const canEdit = canEditProject(project, session);
  const isAdmin = session?.role === 'admin';
  // Read-only when archived (nobody edits) or the viewer lacks edit rights.
  const readOnly = archived || !canEdit;

  return (
    <Stack gap={4}>
      <Inline gap={3} align="center" justify="between" wrap>
        {backLink}

        <Inline gap={2} align="center">
          {archived ? <Badge variant="outline">Archived</Badge> : null}
          <FavoriteButton project={project} />
          {readOnly ? null : (
            <Button
              className="atlas-button"
              size="md"
              variant="solid"
              onClick={() => openQuickAdd(project.id)}
            >
              <IconLabel icon={ACTION_ICONS.create}>New task</IconLabel>
            </Button>
          )}
          <ProjectRowActions
            project={project}
            canManage={canManage}
            isAdmin={isAdmin}
            onEdit={() => setEditing(true)}
            onDeleted={() => void navigate('/projects')}
          />
        </Inline>
      </Inline>

      <Inline gap={3} align="center" justify="start" wrap>
        <ProjectIcon icon={project.icon} size="lg" />
        <Heading level={1} visualLevel={3}>
          {project.name}
        </Heading>
      </Inline>

      {project.description ? <Text size="sm">{project.description}</Text> : null}

      <StatGroup>
        <Stat label="Open" value={openTaskCount} />
        <Stat label="Closed" value={doneTaskCount} />
        <Stat label="Total" value={totalTaskCount} />
        <Stat label="Progress" value={`${percent}%`} />
      </StatGroup>

      {archived ? (
        <Alert tone="info">
          This project is archived and read-only. Restore it to add or edit tasks.
        </Alert>
      ) : !canEdit ? (
        <Alert tone="info">You have view-only access to this project.</Alert>
      ) : null}

      <Tabs defaultValue="tasks">
        <TabList>
          <Tab value="tasks">Tasks</Tab>
          <Tab value="members">Members</Tab>
        </TabList>

        <TabPanel value="tasks">
          <TaskTable
            query={{ projectId: project.id, includeClosed: true, includeArchived: true }}
            ariaLabel={`Tasks in ${project.name}`}
            readOnly={readOnly}
            emptyState={
              <EmptyState
                icon={<Icon icon={ACTION_ICONS.task} size="lg" />}
                title="No tasks yet"
                description={
                  readOnly ? 'This project has no tasks.' : 'Add the first task to this project.'
                }
                action={
                  readOnly ? null : (
                    <Button variant="solid" onClick={() => openQuickAdd(project.id)}>
                      <IconLabel icon={ACTION_ICONS.create}>New task</IconLabel>
                    </Button>
                  )
                }
              />
            }
          />
        </TabPanel>

        <TabPanel value="members">
          <ProjectMembers project={project} canManage={canManage} />
        </TabPanel>
      </Tabs>

      {editing ? (
        <ProjectFormModal project={project} isOpen onClose={() => setEditing(false)} />
      ) : null}
    </Stack>
  );
}
