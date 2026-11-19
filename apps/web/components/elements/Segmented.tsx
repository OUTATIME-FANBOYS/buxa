'use client';

import { Button, Icon } from '../atoms';

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: string }[];
  label: string;
  /** Extra classes for the group, for a screen that sizes it (the settings cards). */
  className?: string;
}) {
  return (
    <div className={`segmented ${className ?? ''}`.trim()} role="radiogroup" aria-label={label}>
      {options.map(o => (
        <Button
          key={o.value}
          variant="ghost"
          size="sm"
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
          title={o.label}
        >
          {o.icon && <Icon name={o.icon} size={15} />}
          <span className={o.icon ? 'seg-label' : ''}>{o.label}</span>
        </Button>
      ))}
    </div>
  );
}
