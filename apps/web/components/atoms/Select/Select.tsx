'use client';

import { Description } from '@heroui/react/description';
import { FieldError } from '@heroui/react/field-error';
import { Label } from '@heroui/react/label';
import { ListBox } from '@heroui/react/list-box';
import { Select as HeroSelect } from '@heroui/react/select';
import type { ReactNode } from 'react';

/*
 * A labelled dropdown that picks one option. Options are plain data (value, label), so the atom knows nothing about
 * the app. The chosen value is a string; `name` submits it with the form, as a native <select> would.
 * `placeholder` is shown while nothing is chosen (use it for an "All ..." or "Choose ..." first choice).
 */
export interface SelectOption {
  value: string;
  label: string;
  isDisabled?: boolean;
}

export interface SelectProps {
  label: string;
  /** Hide the visible label (it stays the accessible name). Use only where the surrounding text already says what it is. */
  hideLabel?: boolean;
  name?: string;
  options: SelectOption[];
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  error?: string | null;
  hint?: ReactNode;
  isRequired?: boolean;
  isDisabled?: boolean;
  id?: string;
  className?: string;
}

export function Select({
  label,
  hideLabel = false,
  name,
  options,
  value,
  defaultValue,
  onChange,
  placeholder,
  error,
  hint,
  isRequired,
  isDisabled,
  id,
  className,
}: SelectProps) {
  return (
    <HeroSelect
      id={id}
      name={name}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={key => onChange?.(key === null ? null : String(key))}
      placeholder={placeholder}
      isInvalid={Boolean(error)}
      isRequired={isRequired}
      isDisabled={isDisabled}
      className={className}
      fullWidth
    >
      <Label className={hideLabel ? 'sr-only' : undefined}>{label}</Label>
      <HeroSelect.Trigger>
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      {error ? <FieldError>{error}</FieldError> : hint ? <Description>{hint}</Description> : null}
      <HeroSelect.Popover>
        <ListBox>
          {options.map(option => (
            <ListBox.Item key={option.value} id={option.value} textValue={option.label} isDisabled={option.isDisabled}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  );
}
