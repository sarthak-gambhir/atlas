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
import { Link } from 'react-router';

import { canManageProject } from '../../lib/organization.ts';
import { ProjectIcon } from '../../lib/projectIcons.tsx';
import { useSession } from '../../lib/session.ts';
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
  const canManage = canManageProject(project, session);
  const { openTaskCount, doneTaskCount, totalTaskCount } = project;
  const percent = totalTaskCount > 0 ? Math.round((doneTaskCount / totalTaskCount) * 100) : 0;

  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
      <CardBody style={{ flex: 1 }}>
        <Stack gap={3}>
          <Stack gap={2}>
            <Inline gap={2} align="center" justify="between" wrap={false}>
              <ProjectIcon icon={project.icon} size={ICON_SIZES.xxl} />

              <Inline gap={2} align="center" wrap={false}>
                {project.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
                <ProjectRowActions
                  project={project}
                  canManage={canManage}
                  isAdmin={isAdmin}
                  onEdit={onEdit}
                />
              </Inline>
            </Inline>

            <Stack gap={1}>
              <Link to={`/projects/${project.id}`} className="atlas-card-link">
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
    </Card>
  );
}
