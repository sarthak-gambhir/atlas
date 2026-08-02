import {
  Button,
  Divider,
  FormField,
  Heading,
  Inline,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  Textarea,
  useToast,
} from '@astrabound/duality';
import type { ProjectDto } from '@atlas/shared';
import { useState, type FormEvent } from 'react';

import { useCreateProject, useUpdateProject } from '../../lib/organization.ts';
import { useSession } from '../../lib/session.ts';
import { toProjectIconKey, type ProjectIconKey } from '../../lib/projectIcons.tsx';
import { IconPicker } from './IconPicker.tsx';
import {
  defaultsToDraft,
  draftToDefaults,
  EMPTY_DEFAULTS,
  ProjectDefaultsFields,
  type DefaultsDraft,
} from './ProjectDefaultsFields.tsx';

interface ProjectFormModalProps {
  /** Present for editing; omit to create. */
  project?: ProjectDto;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Create/edit dialog. Mount fresh (or via a changing `key`) so the initial state
 * from `project` stays live on each open.
 */
export function ProjectFormModal({ project, isOpen, onClose }: ProjectFormModalProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { data: session } = useSession();
  const { toast } = useToast();
  const editing = project != null;

  // A default assignee must be a member: when editing, the project's members;
  // when creating, only the creator (the first and only member at that point).
  const memberIds = project?.memberIds ?? (session ? [session.id] : []);

  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [icon, setIcon] = useState<ProjectIconKey>(toProjectIconKey(project?.icon));
  const [defaults, setDefaults] = useState<DefaultsDraft>(
    project ? defaultsToDraft(project.defaults) : EMPTY_DEFAULTS,
  );

  const isPending = createProject.isPending || updateProject.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      name: name.trim(),
      description: description.trim() === '' ? null : description,
      icon,
      defaults: draftToDefaults(defaults),
    };

    if (editing) {
      updateProject.mutate(
        { id: project.id, ...payload },
        {
          onSuccess: () => {
            toast({ title: 'Project saved', tone: 'success' });
            onClose();
          },
          onError: (cause) =>
            toast({ title: 'Could not save project', description: cause.message, tone: 'error' }),
        },
      );
    } else {
      createProject.mutate(payload, {
        onSuccess: () => {
          toast({ title: 'Project created', tone: 'success' });
          onClose();
        },
        onError: (cause) =>
          toast({ title: 'Could not create project', description: cause.message, tone: 'error' }),
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      showCloseButton
      aria-label={editing ? 'Edit project' : 'New project'}
    >
      <form onSubmit={submit} className="atlas-modal-form">
        <ModalHeader>
          <Heading level={2} visualLevel={4}>
            {editing ? 'Edit project' : 'New project'}
          </Heading>
        </ModalHeader>

        <ModalBody>
          <Stack gap={4}>
            <FormField label="Name" required>
              <Input
                value={name}
                autoFocus
                maxLength={120}
                placeholder="Website"
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>

            <FormField label="Description">
              <Textarea
                value={description}
                autosize
                minRows={2}
                maxRows={10}
                maxLength={1048}
                showCount
                onChange={(event) => setDescription(event.target.value)}
              />
            </FormField>

            <FormField label="Icon">
              <IconPicker value={icon} onChange={setIcon} />
            </FormField>

            <Divider />

            <Heading level={3} visualLevel={5}>
              Defaults
            </Heading>
            <ProjectDefaultsFields value={defaults} onChange={setDefaults} memberIds={memberIds} />
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Inline gap={2} justify="end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="solid" disabled={isPending || name.trim() === ''}>
              {isPending ? 'Saving...' : editing ? 'Save changes' : 'Create project'}
            </Button>
          </Inline>
        </ModalFooter>
      </form>
    </Modal>
  );
}
