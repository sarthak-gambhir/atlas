import {
  Button,
  FormField,
  Heading,
  Inline,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Stack,
  useToast,
} from '@astrabound/duality';
import { USER_ROLES, type UserRole } from '@atlas/shared';
import { useState, type FormEvent } from 'react';

import { useCreateUser } from '../../lib/admin.ts';

interface AddPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddPersonModal({ isOpen, onClose }: AddPersonModalProps) {
  const createUser = useCreateUser();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [reveal, setReveal] = useState(false);

  const reset = () => {
    setUsername('');
    setDisplayName('');
    setPassword('');
    setRole('member');
    setReveal(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createUser.mutate(
      { username, displayName, password, role },
      {
        onSuccess: () => {
          toast({ title: `Created ${username}`, tone: 'success' });
          close();
        },
        onError: (cause) =>
          toast({ title: 'Could not create user', description: cause.message, tone: 'error' }),
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size="md" showCloseButton aria-label="Add person">
      <form onSubmit={submit}>
        <ModalHeader>
          <Heading level={2} visualLevel={4}>
            Add person
          </Heading>
        </ModalHeader>

        <ModalBody>
          <Stack gap={4}>
            <FormField label="Username" required>
              <Input
                value={username}
                autoFocus
                autoComplete="off"
                placeholder="letters, numbers, dot, dash, underscore"
                onChange={(event) => setUsername(event.target.value)}
              />
            </FormField>

            <FormField label="Display name" required>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </FormField>

            <FormField label="Password" hint="At least 8 characters" required>
              <Inline gap={2} align="center">
                <Input
                  type={reveal ? 'text' : 'password'}
                  value={password}
                  autoComplete="new-password"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setReveal((on) => !on)}>
                  {reveal ? 'Hide' : 'Show'}
                </Button>
              </Inline>
            </FormField>

            <FormField label="Role">
              <Select
                value={role}
                options={USER_ROLES.map((value) => ({ value, label: value }))}
                onValueChange={(value) => setRole(value as UserRole)}
              />
            </FormField>
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Inline gap={2} justify="end">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="solid"
              disabled={
                createUser.isPending ||
                username.trim() === '' ||
                displayName.trim() === '' ||
                password.length < 8
              }
            >
              {createUser.isPending ? 'Creating...' : 'Create user'}
            </Button>
          </Inline>
        </ModalFooter>
      </form>
    </Modal>
  );
}
