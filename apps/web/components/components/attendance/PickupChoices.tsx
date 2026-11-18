'use client';

import type { PickupOption } from '@buxa/shared';
import { RadioGroup } from '@/components/atoms';

interface Props {
  name: string;
  options: readonly PickupOption[];
  value: string | null;
  onChange: (personId: string) => void;
}

/** The guardians who may collect this child, as radio buttons: keyboard and screen-reader friendly, each with a 44px target. */
export function PickupChoices({ name, options, value, onChange }: Props) {
  return (
    <RadioGroup
      label="Who is collecting?"
      name={name}
      value={value}
      onChange={onChange}
      options={options.map(option => ({
        value: option.personId,
        label: option.name,
        description: option.relationship,
      }))}
    />
  );
}
