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

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Tasks', Icon: RiListCheck2 },
  { path: '/board', label: 'Board', Icon: RiLayoutColumnLine },
  { path: '/matrix', label: 'Matrix', Icon: RiGridLine },
  { path: '/projects', label: 'Projects', Icon: RiFolderLine },
  { path: '/settings', label: 'Settings', Icon: RiSettings3Line },
];

/** The longest nav path the current location sits under, for highlighting. */
export function activeNavPath(pathname: string): string {
  return (
    NAV_ITEMS.map((item) => item.path)
      .filter((path) => path !== '/' && pathname.startsWith(path))
      .at(0) ?? '/'
  );
}
