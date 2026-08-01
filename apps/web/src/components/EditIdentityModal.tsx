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
  Stack,
  Text,
} from '@astrabound/duality';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { useUsernameAvailability } from '../lib/session.ts';

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;

interface EditIdentityModalProps {
  title: string;
  currentDisplayName: string;
  currentUsername: string;
  /** The account being edited; its own current name is treated as available. */
  excludeUserId: string;
  /** Extra copy shown once the username actually changes (e.g. a warning). */
  usernameChangeNote?: ReactNode;
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onSave: (values: { displayName: string; username: string }) => void;
}

/**
 * Shared editor for a person's display name and username. Callers remount it on
 * each open (via a changing `key`) so these initial values stay live, own the
 * mutation, and close the modal on success.
 */
export function EditIdentityModal({
  title,
  currentDisplayName,
  currentUsername,
  excludeUserId,
  usernameChangeNote,
  isOpen,
  isPending,
  onClose,
  onSave,
}: EditIdentityModalProps) {
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [username, setUsername] = useState(currentUsername);
  const [debounced, setDebounced] = useState(currentUsername);

  const trimmedUsername = username.trim();

  // Debounce the availability probe so we don't fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(trimmedUsername), 300);
    return () => clearTimeout(handle);
  }, [trimmedUsername]);

  const trimmedName = displayName.trim();
  const usernameChanged = trimmedUsername !== currentUsername;
  const validFormat = USERNAME_PATTERN.test(trimmedUsername);
  const shouldCheck = usernameChanged && validFormat && debounced === trimmedUsername;

  const availability = useUsernameAvailability(trimmedUsername, shouldCheck, excludeUserId);
  const checking = shouldCheck && availability.isFetching;
  const available = availability.data?.available === true;
  const taken = shouldCheck && !availability.isFetching && availability.data?.available === false;

  let usernameError: string | undefined;
  if (usernameChanged && !validFormat) {
    usernameError = '3–50 characters: letters, numbers, dot, dash and underscore only.';
  } else if (taken) {
    usernameError = 'That username is taken.';
  }

  let usernameHint: string | undefined;
  if (!usernameError) {
    if (!usernameChanged) usernameHint = 'Used to sign in.';
    else if (checking) usernameHint = 'Checking availability…';
    else if (available) usernameHint = 'Available';
  }

  const nameChanged = trimmedName !== currentDisplayName;
  const hasChange = nameChanged || usernameChanged;
  const usernameOk = !usernameChanged || (validFormat && available && !checking);
  const canSave = !isPending && trimmedName !== '' && usernameOk && hasChange;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;
    onSave({ displayName: trimmedName, username: trimmedUsername });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" showCloseButton aria-label={title}>
      <form onSubmit={submit}>
        <ModalHeader>
          <Heading level={2} visualLevel={4}>
            {title}
          </Heading>
        </ModalHeader>

        <ModalBody>
          <Stack gap={4}>
            <FormField label="Display name" required>
              <Input
                value={displayName}
                autoFocus
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </FormField>

            <FormField label="Username" error={usernameError} hint={usernameHint} required>
              <Input
                value={username}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setUsername(event.target.value)}
              />
            </FormField>

            {usernameChanged && usernameChangeNote ? (
              <Text size="sm">{usernameChangeNote}</Text>
            ) : null}
          </Stack>
        </ModalBody>

        <ModalFooter>
          <Inline gap={2} justify="end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="solid" disabled={!canSave}>
              {isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </Inline>
        </ModalFooter>
      </form>
    </Modal>
  );
}
