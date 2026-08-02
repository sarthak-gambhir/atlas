import { PROJECT_ICON_KEYS, type ProjectIconKey } from '@atlas/shared';
import type { IconType } from 'react-icons';
import {
  RiBookLine,
  RiBriefcaseLine,
  RiBugLine,
  RiCalendarLine,
  RiChat3Line,
  RiCloudLine,
  RiCodeLine,
  RiDatabase2Line,
  RiFlagLine,
  RiFlaskLine,
  RiFocus3Line,
  RiFolderLine,
  RiLightbulbLine,
  RiPaletteLine,
  RiRocketLine,
  RiStarLine,
} from 'react-icons/ri';

/** Every curated icon key mapped to its Remix glyph. */
export const PROJECT_ICONS: Record<ProjectIconKey, IconType> = {
  folder: RiFolderLine,
  rocket: RiRocketLine,
  bug: RiBugLine,
  flask: RiFlaskLine,
  book: RiBookLine,
  code: RiCodeLine,
  palette: RiPaletteLine,
  briefcase: RiBriefcaseLine,
  lightbulb: RiLightbulbLine,
  target: RiFocus3Line,
  cloud: RiCloudLine,
  database: RiDatabase2Line,
  flag: RiFlagLine,
  star: RiStarLine,
  calendar: RiCalendarLine,
  chat: RiChat3Line,
};

export const DEFAULT_PROJECT_ICON: ProjectIconKey = 'folder';

/** Narrows an arbitrary stored value to a known key, defaulting to folder. */
export function toProjectIconKey(value: string | null | undefined): ProjectIconKey {
  return value != null && value in PROJECT_ICONS ? (value as ProjectIconKey) : DEFAULT_PROJECT_ICON;
}

interface ProjectIconProps {
  icon: string | null | undefined;
  size?: number;
  'aria-hidden'?: boolean;
}

/** Renders a project's icon (or the folder fallback) as a Remix glyph. */
export function ProjectIcon({ icon, size = 20, 'aria-hidden': ariaHidden = true }: ProjectIconProps) {
  const Glyph = PROJECT_ICONS[toProjectIconKey(icon)];
  return <Glyph size={size} aria-hidden={ariaHidden} />;
}

export { PROJECT_ICON_KEYS };
export type { ProjectIconKey };
