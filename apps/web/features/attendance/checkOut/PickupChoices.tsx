'use client';

import type { PickupOption } from '@/server/services';

interface Props { name: string; options: readonly PickupOption[]; value: string | null; onChange: (personId: string) => void }

/** The guardians who may collect this child, as radio buttons: keyboard and screen-reader friendly, each with a 44px target. */
export function PickupChoices({ name, options, value, onChange }: Props) {
  return (
    <fieldset className="plain pickup-choices">
      <legend className="field-label">Who is collecting?</legend>
      {options.map(option => (
        <label key={option.personId} className="choice">
          <input type="radio" name={name} value={option.personId} checked={value === option.personId}
            onChange={() => onChange(option.personId)} />
          <span>{option.name}</span>
          <span className="muted small">{option.relationship}</span>
        </label>
      ))}
    </fieldset>
  );
}
