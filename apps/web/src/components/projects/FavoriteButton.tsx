import { Button, Icon } from '@astrabound/duality';
import type { ProjectDto } from '@atlas/shared';

import { ACTION_ICONS } from '../../lib/icons.ts';
import { useToggleProjectFavorite } from '../../lib/organization.ts';

interface FavoriteButtonProps {
  project: Pick<ProjectDto, 'id' | 'name' | 'isFavorite'>;
  size?: 'sm' | 'md' | 'lg';
}

/** Toggles the viewer's favorite flag on a project (filled star when favorited). */
export function FavoriteButton({ project, size = 'md' }: FavoriteButtonProps) {
  const toggle = useToggleProjectFavorite();
  // A static name plus aria-pressed conveys the on/off state; a label that flips
  // to "Unfavorite" would contradict the "pressed" a screen reader announces.
  const label = `Favorite ${project.name}`;

  return (
    <Button
      className="atlas-button atlas-icon-button atlas-favorite"
      variant="ghost"
      size={size}
      aria-pressed={project.isFavorite}
      aria-label={label}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ id: project.id, favorite: !project.isFavorite })}
    >
      <Icon
        size={size}
        icon={project.isFavorite ? ACTION_ICONS.favorite : ACTION_ICONS.favoriteOff}
      />
    </Button>
  );
}
