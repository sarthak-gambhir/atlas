import { Icon } from '@astrabound/duality';

import { PROJECT_ICON_KEYS, PROJECT_ICONS, type ProjectIconKey } from '../../lib/projectIcons.tsx';

interface IconPickerProps {
  value: ProjectIconKey;
  onChange: (icon: ProjectIconKey) => void;
}

/** A grid of pressable tiles for picking a project's icon. */
export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="atlas-icon-grid" role="radiogroup" aria-label="Project icon">
      {PROJECT_ICON_KEYS.map((key) => {
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            className="atlas-icon-option"
            role="radio"
            aria-checked={selected}
            aria-pressed={selected}
            aria-label={key}
            title={key}
            onClick={() => onChange(key)}
          >
            <Icon icon={PROJECT_ICONS[key]} size="md" />
          </button>
        );
      })}
    </div>
  );
}
