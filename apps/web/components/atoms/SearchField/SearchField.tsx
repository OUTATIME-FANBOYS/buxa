'use client';

import { Label } from '@heroui/react/label';
import { SearchField as HeroSearchField } from '@heroui/react/search-field';
import type { FocusEvent, KeyboardEvent, Ref } from 'react';

/*
 * A search box with a search glyph and a clear button. Give it a visible `label` where the box needs one; otherwise
 * `aria-label` names it for assistive technology and `placeholder` tells sighted users what it searches.
 * `inputRef`, `inputProps` and the keyboard and focus handlers are for a parent that runs its own results list (a
 * combobox): they reach the <input> itself and nothing else.
 */
export interface SearchFieldProps {
  label?: string;
  'aria-label'?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  autoFocus?: boolean;
  isDisabled?: boolean;
  id?: string;
  inputRef?: Ref<HTMLInputElement>;
  inputProps?: {
    role?: 'combobox' | 'searchbox';
    'aria-expanded'?: boolean;
    'aria-controls'?: string;
    onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
    onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
    onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  };
  className?: string;
  maxLength?: number;
  autoComplete?: string;
}

export function SearchField({
  label,
  'aria-label': ariaLabel,
  name,
  placeholder,
  value,
  defaultValue,
  onChange,
  autoFocus,
  isDisabled,
  id,
  inputRef,
  inputProps,
  className,
  maxLength,
  autoComplete,
}: SearchFieldProps) {
  return (
    <HeroSearchField
      id={id}
      name={name}
      aria-label={label ? undefined : ariaLabel}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      autoFocus={autoFocus}
      isDisabled={isDisabled}
      className={className}
      fullWidth
    >
      {label ? <Label>{label}</Label> : null}
      <HeroSearchField.Group>
        <HeroSearchField.SearchIcon />
        <HeroSearchField.Input
          placeholder={placeholder}
          ref={inputRef}
          maxLength={maxLength}
          autoComplete={autoComplete}
          {...inputProps}
        />
        <HeroSearchField.ClearButton />
      </HeroSearchField.Group>
    </HeroSearchField>
  );
}
