import { Button, Divider, Input, Stack } from '@astrabound/duality';

import { ACTION_ICONS } from '../lib/icons.ts';
import { QuickFilterBar, QuickFilterChip } from './QuickFilterChip.tsx';

export interface ProjectFilterFieldsProps {
  search: string;
  onSearchChange: (value: string) => void;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  isFiltered: boolean;
  onClear: () => void;
}

/** Project filter controls for a popover or modal panel. */
export function ProjectFilterFields({
  search,
  onSearchChange,
  includeArchived,
  onIncludeArchivedChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  isFiltered,
  onClear,
}: ProjectFilterFieldsProps) {
  return (
    <Stack gap={3}>
      <QuickFilterBar>
        <QuickFilterChip
          icon={ACTION_ICONS.favorite}
          active={favoritesOnly}
          onToggle={() => onFavoritesOnlyChange(!favoritesOnly)}
        >
          Favorites
        </QuickFilterChip>
        <QuickFilterChip
          icon={ACTION_ICONS.archive}
          active={includeArchived}
          onToggle={() => onIncludeArchivedChange(!includeArchived)}
        >
          Show archived
        </QuickFilterChip>
      </QuickFilterBar>

      <Divider />

      <Input
        value={search}
        placeholder="Search projects"
        clearable
        aria-label="Search projects"
        onClear={() => onSearchChange('')}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      {isFiltered ? (
        <Button className="atlas-button" variant="ghost" size="md" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </Stack>
  );
}
