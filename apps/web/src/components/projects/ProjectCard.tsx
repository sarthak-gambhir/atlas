import {
  Badge,
  Card,
  CardBody,
  CardFooter,
  Inline,
  Stack,
  Text,
  TruncatedText,
} from '@astrabound/duality';
import type { ProjectDto } from '@atlas/shared';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { backState } from '../../lib/backNav.ts';
import { canManageProject } from '../../lib/organization.ts';
import { ProjectIcon } from '../../lib/projectIcons.tsx';
import { useSession } from '../../lib/session.ts';
import { FavoriteButton } from './FavoriteButton.tsx';
import { ManageMembersModal } from './ManageMembersModal.tsx';
import { ProjectRowActions } from './ProjectRowActions.tsx';
import { ICON_SIZES } from '../../lib/icons.ts';
import { TagBadge } from '../TagBadge.tsx';

interface ProjectCardProps {
  project: ProjectDto;
  isAdmin: boolean;
  onEdit: () => void;
}

export function ProjectCard({ project, isAdmin, onEdit }: ProjectCardProps) {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const canManage = canManageProject(project, session);
  const [managingMembers, setManagingMembers] = useState(false);
  const { openTaskCount, doneTaskCount, totalTaskCount } = project;
  const percent = totalTaskCount > 0 ? Math.round((doneTaskCount / totalTaskCount) * 100) : 0;
  // Opening a project records Projects as the origin, so its "Back" link returns here.
  const projectOrigin = backState({ label: 'Projects', to: location.pathname + location.search });
  const openProject = () => void navigate(`/projects/${project.id}`, { state: projectOrigin });

  return (
    <Card
      className="atlas-project-card"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <CardBody style={{ flex: 1 }}>
        <Stack gap={3}>
          <Stack gap={2}>
            <Inline gap={2} align="center" justify="between" wrap={false}>
              <ProjectIcon icon={project.icon} size={ICON_SIZES.xxl} />

              <div className="atlas-project-card__actions">
                <Inline gap={2} align="center" wrap={false}>
                  {project.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
                  <FavoriteButton project={project} />
                  <ProjectRowActions
                    project={project}
                    canManage={canManage}
                    isAdmin={isAdmin}
                    onEdit={onEdit}
                    onView={openProject}
                    onManageMembers={canManage ? () => setManagingMembers(true) : undefined}
                  />
                </Inline>
              </div>
            </Inline>

            <Stack gap={1}>
              <Link
                to={`/projects/${project.id}`}
                state={projectOrigin}
                className="atlas-card-link atlas-card-link-stretch"
              >
                <TruncatedText lines={2} size="lg" weight="bold">
                  {project.name}
                </TruncatedText>
              </Link>
              {project.description ? (
                <TruncatedText lines={3} size="sm">
                  {project.description}
                </TruncatedText>
              ) : null}
            </Stack>
          </Stack>

          {project.defaults.tags.length > 0 ? (
            <Inline gap={1} wrap>
              {project.defaults.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </Inline>
          ) : null}
        </Stack>
      </CardBody>

      <CardFooter>
        <Stack gap={1}>
          <div
            className="atlas-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Completion"
          >
            <span className="atlas-progress-fill" style={{ inlineSize: `${percent}%` }} />
          </div>
          <Text size="sm">
            {totalTaskCount === 0
              ? 'No tasks yet'
              : `${openTaskCount} open \u00b7 ${doneTaskCount} closed \u00b7 ${totalTaskCount} total`}
          </Text>
        </Stack>
      </CardFooter>

      {managingMembers ? (
        <ManageMembersModal
          project={project}
          canManage={canManage}
          isOpen
          onClose={() => setManagingMembers(false)}
        />
      ) : null}
    </Card>
  );
}
