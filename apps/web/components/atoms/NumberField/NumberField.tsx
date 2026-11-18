'use client';

import { Description } from '@heroui/react/description';
import { FieldError } from '@heroui/react/field-error';
import { Label } from '@heroui/react/label';
import { NumberField as HeroNumberField } from '@heroui/react/number-field';
import type { ReactNode } from 'react';

/*
 * A labelled numeric input with no steppers, for counts, ages and capacities. Its value is a number, or NaN while the
 * field is empty (HeroUI's convention); `name` submits the digits, so a server form still reads a string.
 */
export interface NumberFieldProps {
  label: string;
  name?: string;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  minValue?: number;
  maxValue?: number;
  error?: string | null;
  hint?: ReactNode;
  placeholder?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  id?: string;
}

export function NumberField({
  label,
  name,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  error,
  hint,
  placeholder,
  isRequired,
  isDisabled,
  id,
}: NumberFieldProps) {
  return (
    <HeroNumberField
      id={id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      minValue={minValue}
      maxValue={maxValue}
      isInvalid={Boolean(error)}
      isRequired={isRequired}
      isDisabled={isDisabled}
      formatOptions={{ useGrouping: false }}
      fullWidth
    >
      <Label>{label}</Label>
      <HeroNumberField.Group>
        <HeroNumberField.Input placeholder={placeholder} inputMode="numeric" />
      </HeroNumberField.Group>
      {error ? <FieldError>{error}</FieldError> : hint ? <Description>{hint}</Description> : null}
    </HeroNumberField>
  );
}
