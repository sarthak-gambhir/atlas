import { createContext, useContext } from 'react';

/** Opens the quick-add modal, optionally pre-selecting a project. */
export type OpenQuickAdd = (projectId?: string) => void;

/**
 * Quick add lives in the app shell so the command palette and its keyboard
 * shortcut can reach it from any page.
 */
export const QuickAddContext = createContext<OpenQuickAdd | null>(null);

export function useQuickAdd(): OpenQuickAdd {
  const open = useContext(QuickAddContext);
  if (!open) throw new Error('useQuickAdd must be used inside the app shell.');
  return open;
}
