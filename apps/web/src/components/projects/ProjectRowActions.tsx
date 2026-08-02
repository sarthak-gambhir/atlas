import {
  Button,
  ConfirmDialog,
  Menu,
  MenuItem,
  MenuSeparator,
  useToast,
} from '@astrabound/duality';
import type { ProjectDto } from '@atlas/shared';
import { useState } from 'react';
import { RiMore2Fill } from 'react-icons/ri';

import { useDeleteProject, useUpdateProject } from '../../lib/organization.ts';

interface ProjectRowActionsProps {
  project: ProjectDto;
  /** Owner-or-admin: may edit and archive/restore. */
  canManage: boolean;
  /** Admin only: may delete. */
  isAdmin: boolean;
  onEdit: () => void;
  /** Called after a successful delete, e.g. to navigate away from a detail page. */
  onDeleted?: () => void;
}

/** The per-project action menu: edit, archive/restore and (admin) delete. */
export function ProjectRowActions({
  project,
  canManage,
  isAdmin,
  onEdit,
  onDeleted,
}: ProjectRowActionsProps) {
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { toast } = useToast();

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const archived = project.archivedAt != null;

  // Nothing to offer when the viewer can neither manage nor delete.
  if (!canManage && !isAdmin) return null;

  const count = project.totalTaskCount;
  const deleteDescription =
    count > 0
      ? `This permanently removes the project. Its ${count} ${
          count === 1 ? 'task is' : 'tasks are'
        } kept but no longer ${
          count === 1 ? 'belongs' : 'belong'
        } to any project. This cannot be undone.`
      : 'This permanently removes the project. This cannot be undone.';

  const setArchived = (next: boolean) =>
    updateProject.mutate(
      { id: project.id, archived: next },
      {
        onSuccess: () =>
          toast({ title: next ? 'Project archived' : 'Project restored', tone: 'success' }),
        onError: (cause) =>
          toast({ title: 'Could not update project', description: cause.message, tone: 'error' }),
      },
    );

  const remove = () =>
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast({ title: `${project.name} deleted`, tone: 'success' });
        setConfirmingDelete(false);
        onDeleted?.();
      },
      onError: (cause) =>
        toast({ title: 'Could not delete project', description: cause.message, tone: 'error' }),
    });

  return (
    <>
      <Menu
        placement="bottom-end"
        trigger={
          <Button
            variant="inverse"
            size="sm"
            aria-label={`Actions for ${project.name}`}
            className="atlas-action-menu-button"
          >
            <RiMore2Fill aria-hidden />
          </Button>
        }
      >
        {canManage ? (
          <>
            <MenuItem onSelect={onEdit}>Edit</MenuItem>
            <MenuItem onSelect={() => setArchived(!archived)}>
              {archived ? 'Restore' : 'Archive'}
            </MenuItem>
          </>
        ) : null}

        {isAdmin ? (
          <>
            {canManage ? <MenuSeparator /> : null}
            <MenuItem onSelect={() => setConfirmingDelete(true)}>Delete</MenuItem>
          </>
        ) : null}
      </Menu>

      <ConfirmDialog
        isOpen={confirmingDelete}
        tone="danger"
        title={`Delete ${project.name}?`}
        description={deleteDescription}
        confirmLabel="Delete"
        isLoading={deleteProject.isPending}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={remove}
      />
    </>
  );
}
