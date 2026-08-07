import { CommandPalette, useToast, type Command } from '@astrabound/duality';
import { useNavigate } from 'react-router';

import { downloadBackup } from '../lib/admin.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { NAV_ITEMS } from '../lib/nav.ts';
import { useLogout } from '../lib/session.ts';

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  onQuickAdd: () => void;
}

export function CommandBar({ isOpen, onClose, onQuickAdd }: CommandBarProps) {
  const navigate = useNavigate();
  const logout = useLogout();
  const { toast } = useToast();

  // Close first: an action that navigates or opens a dialog should not race the
  // palette's own teardown.
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  const commands: Command[] = [
    {
      id: 'new-task',
      label: 'New task',
      group: 'Actions',
      icon: ACTION_ICONS.create,
      shortcut: ['N'],
      keywords: ['add', 'create'],
      onSelect: run(onQuickAdd),
    },
    ...NAV_ITEMS.map((item) => ({
      id: `go-${item.path}`,
      label: `Go to ${item.label}`,
      group: 'Navigate',
      icon: item.Icon,
      keywords: [item.label.toLowerCase()],
      onSelect: run(() => void navigate(item.path)),
    })),
    {
      id: 'export',
      label: 'Download export',
      group: 'Data',
      icon: ACTION_ICONS.export,
      keywords: ['backup', 'json', 'save'],
      onSelect: run(() => {
        void downloadBackup().catch((cause: unknown) =>
          toast({
            title: 'Export failed',
            description: cause instanceof Error ? cause.message : 'Unknown error',
            tone: 'error',
          }),
        );
      }),
    },
    {
      id: 'sign-out',
      label: 'Sign out',
      group: 'Account',
      icon: ACTION_ICONS.signOut,
      onSelect: run(() => logout.mutate()),
    },
  ];

  return (
    <CommandPalette
      className="atlas-command-palette"
      isOpen={isOpen}
      onClose={onClose}
      commands={commands}
      placeholder="Search commands..."
      aria-label="Command palette"
    />
  );
}
