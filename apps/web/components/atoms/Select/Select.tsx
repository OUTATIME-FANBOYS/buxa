'use client';

import { useId, type ReactNode } from 'react';

/*
 * A labelled dropdown that picks one option. Plain HTML: a native <select>, styled by the app's own select rules, so it
 * needs no HeroUI styles and opens with the device's own picker. Options are plain data (value, label).
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
  const generated = useId();
  const selectId = id ?? generated;
  const hasPlaceholder = placeholder !== undefined;
  const current = value === undefined ? undefined : (value ?? '');

  return (
    <div className={`select-field ${className ?? ''}`}>
      <label className={hideLabel ? 'sr-only' : 'field-label'} htmlFor={selectId}>
        {label}
        {isRequired ? ' *' : null}
      </label>
      <select
        id={selectId}
        name={name}
        required={isRequired}
        disabled={isDisabled}
        aria-invalid={Boolean(error) || undefined}
        {...(current !== undefined ? { value: current } : { defaultValue: defaultValue ?? '' })}
        onChange={e => onChange?.(e.target.value === '' ? null : e.target.value)}
        className="select-field__input"
      >
        {hasPlaceholder ? (
          <option value="" disabled={isRequired}>
            {placeholder}
          </option>
        ) : null}
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.isDisabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}
