import type { IconType } from 'react-icons';
import {
  RiFolderLine,
  RiGridLine,
  RiLayoutColumnLine,
  RiListCheck2,
  RiSettings3Line,
} from 'react-icons/ri';

export interface NavItem {
  path: string;
  label: string;
  Icon: IconType;
}

/**
 * Canonical glyph per top-level page, so the sidebar and each page's title
 * icon (see PageHeader) stay in lockstep.
 */
export const PAGE_ICONS = {
  tasks: RiListCheck2,
  board: RiLayoutColumnLine,
  matrix: RiGridLine,
  projects: RiFolderLine,
  settings: RiSettings3Line,
} satisfies Record<string, IconType>;

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Tasks', Icon: PAGE_ICONS.tasks },
  { path: '/board', label: 'Board', Icon: PAGE_ICONS.board },
  { path: '/matrix', label: 'Matrix', Icon: PAGE_ICONS.matrix },
  { path: '/projects', label: 'Projects', Icon: PAGE_ICONS.projects },
  { path: '/settings', label: 'Settings', Icon: PAGE_ICONS.settings },
];

/** The longest nav path the current location sits under, for highlighting. */
export function activeNavPath(pathname: string): string {
  return (
    NAV_ITEMS.map((item) => item.path)
      .filter((path) => path !== '/' && pathname.startsWith(path))
      .at(0) ?? '/'
  );
}
