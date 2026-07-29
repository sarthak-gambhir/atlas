import { createContext, useContext } from 'react';

/**
 * Quick add lives in the app shell so the command palette and its keyboard
 * shortcut can reach it from any page.
 */
export const QuickAddContext = createContext<(() => void) | null>(null);

export function useQuickAdd(): () => void {
  const open = useContext(QuickAddContext);
  if (!open) throw new Error('useQuickAdd must be used inside the app shell.');
  return open;
}
