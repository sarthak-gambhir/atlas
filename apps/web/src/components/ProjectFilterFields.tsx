import { Button, Input, Stack } from '@astrabound/duality';

import { ACTION_ICONS } from '../lib/icons.ts';
import { IconLabel } from './IconLabel.tsx';

export interface ProjectFilterFieldsProps {
  search: string;
  onSearchChange: (value: string) => void;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  isFiltered: boolean;
  onClear: () => void;
}

/** Project filter controls for a popover or modal panel. */
export function ProjectFilterFields({
  search,
  onSearchChange,
  includeArchived,
  onIncludeArchivedChange,
  isFiltered,
  onClear,
}: ProjectFilterFieldsProps) {
  return (
    <Stack gap={3}>
      <Input
        value={search}
        placeholder="Search projects"
        clearable
        aria-label="Search projects"
        onClear={() => onSearchChange('')}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <Button
        className="atlas-button"
        variant="inverse"
        size="md"
        onClick={() => onIncludeArchivedChange(!includeArchived)}
      >
        <IconLabel icon={includeArchived ? ACTION_ICONS.hide : ACTION_ICONS.reveal}>
          {includeArchived ? 'Hide archived' : 'Show archived'}
        </IconLabel>
      </Button>

      {isFiltered ? (
        <Button className="atlas-button" variant="ghost" size="md" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </Stack>
  );
}
