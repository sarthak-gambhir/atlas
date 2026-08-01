import { useToast } from '@astrabound/duality';
import type { SessionUser } from '@atlas/shared';

import { useUpdateProfile } from '../../lib/session.ts';
import { EditIdentityModal } from '../EditIdentityModal.tsx';

interface EditProfileModalProps {
  user: SessionUser;
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ user, isOpen, onClose }: EditProfileModalProps) {
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();

  return (
    <EditIdentityModal
      title="Edit profile"
      currentDisplayName={user.displayName}
      currentUsername={user.username}
      excludeUserId={user.id}
      usernameChangeNote="Changing your username also changes how you sign in. Exports you already downloaded still reference the old name."
      isOpen={isOpen}
      isPending={updateProfile.isPending}
      onClose={onClose}
      onSave={(values) =>
        updateProfile.mutate(values, {
          onSuccess: () => {
            toast({ title: 'Profile updated', tone: 'success' });
            onClose();
          },
          onError: (cause) =>
            toast({ title: 'Could not update profile', description: cause.message, tone: 'error' }),
        })
      }
    />
  );
}
