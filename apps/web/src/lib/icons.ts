import type { PriorityBucket, TaskStatus } from '@atlas/shared';
import type { IconType } from 'react-icons';
import {
  RiAddLine,
  RiArchiveLine,
  RiArrowDownSLine,
  RiArrowDownSFill,
  RiArrowLeftLine,
  RiArrowUpDoubleLine,
  RiArrowUpSLine,
  RiCheckLine,
  RiCheckDoubleLine,
  RiArrowDownDoubleLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiEditLine,
  RiErrorWarningLine,
  RiArrowLeftRightLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiFilterLine,
  RiFilterOffLine,
  RiFolderOpenLine,
  RiForbid2Line,
  RiGroupLine,
  RiInboxLine,
  RiInboxUnarchiveLine,
  RiRefreshLine,
  RiLockPasswordLine,
  RiLogoutBoxRLine,
  RiMenuLine,
  RiMore2Fill,
  RiArrowRightDoubleLine,
  RiSearchEyeLine,
  RiSearchLine,
  RiSettings3Line,
  RiShieldUserLine,
  RiStarFill,
  RiStarLine,
  RiTaskLine,
  RiUploadLine,
  RiUserLine,
  RiUserAddLine,
  RiUserFollowLine,
  RiUserForbidLine,
  RiUserStarLine,
  RiCalendarLine,
  RiHashtag,
} from 'react-icons/ri';

/**
 * The app's icon vocabulary. Duality resolves its own internal glyphs through a
 * registry rather than per-call-site imports; this is the Atlas equivalent, so a
 * verb reads the same everywhere it appears.
 */
export const ACTION_ICONS = {
  tag: RiHashtag,
  calendar: RiCalendarLine,

  create: RiAddLine,
  edit: RiEditLine,
  delete: RiDeleteBinLine,
  archive: RiArchiveLine,
  restore: RiInboxUnarchiveLine,
  complete: RiCheckDoubleLine,
  confirm: RiCheckLine,

  export: RiDownloadLine,
  import: RiUploadLine,

  filter: RiFilterLine,
  filterOff: RiFilterOffLine,

  search: RiSearchLine,
  back: RiArrowLeftLine,
  more: RiMore2Fill,
  menu: RiMenuLine,
  copy: RiFileCopyLine,
  reveal: RiEyeLine,
  hide: RiEyeOffLine,

  signOut: RiLogoutBoxRLine,
  settings: RiSettings3Line,
  resetPassword: RiLockPasswordLine,
  addPerson: RiUserAddLine,
  role: RiShieldUserLine,
  makeOwner: RiUserStarLine,
  owner: RiUserStarLine,
  members: RiGroupLine,
  assignee: RiUserLine,
  favorite: RiStarFill,
  favoriteOff: RiStarLine,

  enable: RiUserFollowLine,
  disable: RiUserForbidLine,
  move: RiArrowLeftRightLine,
  expand: RiArrowDownSFill,
  warning: RiErrorWarningLine,
  empty: RiInboxLine,
  noResults: RiSearchEyeLine,
  task: RiTaskLine,
  project: RiFolderOpenLine,
} satisfies Record<string, IconType>;

export type ActionIconKey = keyof typeof ACTION_ICONS;

/** Where a task sits in the flow, mirroring STATUS_LABELS. */
export const STATUS_ICONS: Record<TaskStatus, IconType> = {
  backlog: RiInboxLine,
  next: RiArrowRightDoubleLine,
  in_progress: RiRefreshLine,
  blocked: RiForbid2Line,
  done: RiCheckDoubleLine,
  archived: RiArchiveLine,
};

/**
 * Priority as a slope: urgent work points sharply up, deferred work points down,
 * and `someday` converges to a flat line. Pairs with the `.bucket-badge-*`
 * border-style ladder so priority never rests on a single cue.
 */
export const PRIORITY_ICONS: Record<PriorityBucket, IconType> = {
  now: RiArrowUpDoubleLine,
  next: RiArrowUpSLine,
  later: RiArrowDownSLine,
  someday: RiArrowDownDoubleLine,
};

export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  xxl: 32,
} satisfies Record<string, number>;
