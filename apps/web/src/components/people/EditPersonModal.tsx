import { useToast } from '@astrabound/duality';
import type { UserSummaryDto } from '@atlas/shared';

import { useUpdateUser } from '../../lib/admin.ts';
import { EditIdentityModal } from '../EditIdentityModal.tsx';

interface EditPersonModalProps {
  person: UserSummaryDto;
  isOpen: boolean;
  onClose: () => void;
}

export function EditPersonModal({ person, isOpen, onClose }: EditPersonModalProps) {
  const updateUser = useUpdateUser();
  const { toast } = useToast();

  return (
    <EditIdentityModal
      title={`Edit ${person.displayName}`}
      currentDisplayName={person.displayName}
      currentUsername={person.username}
      excludeUserId={person.id}
      usernameChangeNote="They sign in with this username. Exports already downloaded still reference the old name."
      isOpen={isOpen}
      isPending={updateUser.isPending}
      onClose={onClose}
      onSave={(values) =>
        updateUser.mutate(
          { id: person.id, ...values },
          {
            onSuccess: () => {
              toast({ title: 'Person updated', tone: 'success' });
              onClose();
            },
            onError: (cause) =>
              toast({ title: 'Could not update person', description: cause.message, tone: 'error' }),
          },
        )
      }
    />
  );
}
