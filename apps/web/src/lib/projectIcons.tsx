import { Icon, type IconProps } from '@astrabound/duality';
import { PROJECT_ICON_KEYS, type ProjectIconKey } from '@atlas/shared';
import type { IconType } from 'react-icons';
import {
  RiBarChartLine,
  RiBookLine,
  RiBookmarkLine,
  RiBriefcaseLine,
  RiBugLine,
  RiCalendarLine,
  RiCameraLine,
  RiChat3Line,
  RiCloudLine,
  RiCodeLine,
  RiDatabase2Line,
  RiFlagLine,
  RiFlaskLine,
  RiFocus3Line,
  RiFolderLine,
  RiGlobalLine,
  RiHeartLine,
  RiHomeLine,
  RiKeyLine,
  RiLightbulbLine,
  RiLockLine,
  RiMailLine,
  RiMapPinLine,
  RiMusicLine,
  RiPaletteLine,
  RiPencilLine,
  RiPhoneLine,
  RiPieChartLine,
  RiRocketLine,
  RiSettings3Line,
  RiShieldLine,
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
  heart: RiHeartLine,
  home: RiHomeLine,
  bookmark: RiBookmarkLine,
  shield: RiShieldLine,
  globe: RiGlobalLine,
  settings: RiSettings3Line,
  chart: RiBarChartLine,
  pie: RiPieChartLine,
  mail: RiMailLine,
  phone: RiPhoneLine,
  pin: RiMapPinLine,
  key: RiKeyLine,
  lock: RiLockLine,
  music: RiMusicLine,
  camera: RiCameraLine,
  pencil: RiPencilLine,
};

export const DEFAULT_PROJECT_ICON: ProjectIconKey = 'folder';

/** Narrows an arbitrary stored value to a known key, defaulting to folder. */
export function toProjectIconKey(value: string | null | undefined): ProjectIconKey {
  return value != null && value in PROJECT_ICONS ? (value as ProjectIconKey) : DEFAULT_PROJECT_ICON;
}

interface ProjectIconProps extends Omit<IconProps, 'icon'> {
  icon: string | null | undefined;
}

/** Renders a project's icon (or the folder fallback) as a Remix glyph. */
export function ProjectIcon({ icon, size = 'md', ...rest }: ProjectIconProps) {
  return <Icon icon={PROJECT_ICONS[toProjectIconKey(icon)]} size={size} {...rest} />;
}

export { PROJECT_ICON_KEYS };
export type { ProjectIconKey };
