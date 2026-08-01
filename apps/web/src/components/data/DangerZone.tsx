import {
  Alert,
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
  useToast,
} from '@astrabound/duality';
import { useState } from 'react';

import { useImportBackup } from '../../lib/admin.ts';

const CONFIRM_WORD = 'reset';

export function DangerZone() {
  const reset = useImportBackup();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const close = () => {
    setIsOpen(false);
    setConfirmText('');
  };

  const run = () => {
    reset.mutate(
      { mode: 'replace', bundle: { version: 1, projects: [], tasks: [] } },
      {
        onSuccess: () => {
          toast({ title: 'All tasks, projects and tags deleted', tone: 'success' });
          close();
        },
        onError: (cause) =>
          toast({ title: 'Could not reset data', description: cause.message, tone: 'error' }),
      },
    );
  };

  return (
    <Stack gap={3}>
      <Stack gap={1}>
        <Heading level={3} visualLevel={5}>
          Danger zone
        </Heading>
        <Text size="sm">
          Permanently delete every task, project and tag. People, passwords and scoring settings are
          left untouched. This cannot be undone.
        </Text>
      </Stack>

      <Inline>
        <Button variant="inverse" onClick={() => setIsOpen(true)}>
          Reset all data
        </Button>
      </Inline>

      <Modal isOpen={isOpen} onClose={close} size="sm" showCloseButton aria-label="Reset all data">
        <ModalHeader>
          <Heading level={2} visualLevel={4}>
            Reset all data?
          </Heading>
        </ModalHeader>
        <ModalBody>
          <Stack gap={3}>
            <Alert tone="warning">
              This deletes every task, project and tag. People and their passwords remain. There is
              no undo.
            </Alert>
            <FormField label={`Type "${CONFIRM_WORD}" to confirm`}>
              <Input
                value={confirmText}
                autoFocus
                autoComplete="off"
                onChange={(event) => setConfirmText(event.target.value)}
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
              type="button"
              variant="solid"
              disabled={reset.isPending || confirmText.trim().toLowerCase() !== CONFIRM_WORD}
              onClick={run}
            >
              {reset.isPending ? 'Resetting...' : 'Reset all data'}
            </Button>
          </Inline>
        </ModalFooter>
      </Modal>
    </Stack>
  );
}
