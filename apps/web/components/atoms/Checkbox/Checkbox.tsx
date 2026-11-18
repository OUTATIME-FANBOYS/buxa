'use client';

import { Checkbox as HeroCheckbox } from '@heroui/react/checkbox';
import type { ReactNode } from 'react';

/*
 * A single on/off choice with its label. `name` and `value` submit with the form when checked, as a native checkbox does.
 * Controlled with `isSelected` and `onChange`, or uncontrolled with `defaultSelected`.
 */
export interface CheckboxProps {
  children: ReactNode;
  name?: string;
  value?: string;
  isSelected?: boolean;
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  className?: string;
}

export function Checkbox({
  children,
  name,
  value,
  isSelected,
  defaultSelected,
  onChange,
  isDisabled,
  isRequired,
  isInvalid,
  className,
}: CheckboxProps) {
  return (
    <HeroCheckbox
      name={name}
      value={value}
      isSelected={isSelected}
      defaultSelected={defaultSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      isRequired={isRequired}
      isInvalid={isInvalid}
      className={className}
    >
      <HeroCheckbox.Control>
        <HeroCheckbox.Indicator />
      </HeroCheckbox.Control>
      <HeroCheckbox.Content>{children}</HeroCheckbox.Content>
    </HeroCheckbox>
  );
}
