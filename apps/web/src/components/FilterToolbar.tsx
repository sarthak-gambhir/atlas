import {
  Button,
  Heading,
  Icon,
  Inline,
  Modal,
  ModalBody,
  ModalHeader,
  Popover,
  Stack,
  Text,
} from '@astrabound/duality';
import { useState, type ReactNode } from 'react';

import { ProjectFilterFields } from './ProjectFilterFields.tsx';
import { TaskFilterFields } from './TaskFilterFields.tsx';
import type { UseFilters } from '../lib/filters.ts';
import { ACTION_ICONS } from '../lib/icons.ts';
import { useIsMobile } from '../lib/useIsMobile.ts';

interface FilterToolbarProps {
  isFiltered: boolean;
  activeCount: number;
  title?: string;
  children: ReactNode;
}

/** Filter icon that opens a unified search/filter panel (Popover on desktop, Modal on phone). */
export function FilterToolbar({
  isFiltered,
  activeCount,
  title = 'Filters',
  children,
}: FilterToolbarProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const panel = (
    <div className="atlas-filter-panel">
      <Stack gap={3}>
        <Heading level={2} visualLevel={5}>
          {title}
        </Heading>
        {children}
      </Stack>
    </div>
  );

  const filterLabel =
    activeCount > 0 ? `Filters, ${activeCount} active` : isFiltered ? 'Filters, active' : 'Filters';

  const filterButton = (
    <Button
      className="atlas-button atlas-icon-button"
      variant="inverse"
      size="md"
      aria-label={filterLabel}
    >
      <Inline gap={1} align="center">
        <Icon icon={ACTION_ICONS.filter} />
        {activeCount > 0 ? <Text size="sm">Filters: {activeCount}</Text> : null}
      </Inline>
    </Button>
  );

  if (isMobile) {
    return (
      <>
        <Button
          className="atlas-button atlas-icon-button"
          variant="inverse"
          size="md"
          aria-label={filterLabel}
          onClick={() => setOpen(true)}
        >
          <Inline gap={1} align="center">
            <Icon icon={ACTION_ICONS.filter} />
            {activeCount > 0 ? <Text size="sm">: {activeCount}</Text> : null}
          </Inline>
        </Button>

        <Modal
          className="atlas-filter-modal"
          isOpen={open}
          onClose={() => setOpen(false)}
          size="md"
          showCloseButton
          aria-label={title}
        >
          <ModalHeader>{title}</ModalHeader>
          <ModalBody>
            <div className="atlas-filter-panel">{children}</div>
          </ModalBody>
        </Modal>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" trigger={filterButton}>
      {panel}
    </Popover>
  );
}

interface TaskFilterToolbarProps {
  filters: UseFilters;
  showStatus?: boolean;
  showClosedToggle?: boolean;
  excludeArchived?: boolean;
  /** Tasks page only: the client-side "in favorite projects" quick filter. */
  inFavorites?: boolean;
  onInFavoritesChange?: (value: boolean) => void;
}

export function TaskFilterToolbar({
  filters,
  showStatus = true,
  showClosedToggle = true,
  excludeArchived = false,
  inFavorites,
  onInFavoritesChange,
}: TaskFilterToolbarProps) {
  // inFavorites lives outside useFilters, so fold it into the panel's badge.
  const favoriteActive = inFavorites ?? false;
  return (
    <FilterToolbar
      isFiltered={filters.isFiltered || favoriteActive}
      activeCount={filters.activeCount + (favoriteActive ? 1 : 0)}
    >
      <TaskFilterFields
        filters={filters}
        showStatus={showStatus}
        showClosedToggle={showClosedToggle}
        excludeArchived={excludeArchived}
        inFavorites={inFavorites}
        onInFavoritesChange={onInFavoritesChange}
      />
    </FilterToolbar>
  );
}

interface ProjectFilterToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  isFiltered: boolean;
  activeCount: number;
  onClear: () => void;
}

export function ProjectFilterToolbar({
  search,
  onSearchChange,
  includeArchived,
  onIncludeArchivedChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  isFiltered,
  activeCount,
  onClear,
}: ProjectFilterToolbarProps) {
  return (
    <FilterToolbar isFiltered={isFiltered} activeCount={activeCount} title="Filter projects">
      <ProjectFilterFields
        search={search}
        onSearchChange={onSearchChange}
        includeArchived={includeArchived}
        onIncludeArchivedChange={onIncludeArchivedChange}
        favoritesOnly={favoritesOnly}
        onFavoritesOnlyChange={onFavoritesOnlyChange}
        isFiltered={isFiltered}
        onClear={onClear}
      />
    </FilterToolbar>
  );
}
