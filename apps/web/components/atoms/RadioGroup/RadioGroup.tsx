'use client';

import { Description } from '@heroui/react/description';
import { FieldError } from '@heroui/react/field-error';
import { Label } from '@heroui/react/label';
import { Radio } from '@heroui/react/radio';
import { RadioGroup as HeroRadioGroup } from '@heroui/react/radio-group';
import type { ReactNode } from 'react';

/*
 * A set of mutually exclusive choices, each with its label and an optional note. The group is one labelled fieldset,
 * so arrow keys move between the choices and a screen reader announces the question first. `name` submits the chosen value.
 */
export interface RadioOption {
  value: string;
  label: ReactNode;
  /** A short note under the label (for example a relationship). */
  description?: ReactNode;
  isDisabled?: boolean;
}

export interface RadioGroupProps {
  label: string;
  name?: string;
  options: RadioOption[];
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  error?: string | null;
  isRequired?: boolean;
  isDisabled?: boolean;
}

export function RadioGroup({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
  error,
  isRequired,
  isDisabled,
}: RadioGroupProps) {
  return (
    <HeroRadioGroup
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={next => onChange?.(next)}
      isInvalid={Boolean(error)}
      isRequired={isRequired}
      isDisabled={isDisabled}
    >
      <Label>{label}</Label>
      {options.map(option => (
        <Radio key={option.value} value={option.value} isDisabled={option.isDisabled}>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          <Radio.Content>
            {option.label}
            {option.description ? <Description>{option.description}</Description> : null}
          </Radio.Content>
        </Radio>
      ))}
      {error ? <FieldError>{error}</FieldError> : null}
    </HeroRadioGroup>
  );
}
