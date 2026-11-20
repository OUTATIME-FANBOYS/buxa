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
  /** Drawn inside the field, at its left and centred on the box (the priority signal). The text is padded to clear it. */
  leading?: ReactNode;
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
  leading,
}: SelectProps) {
  const generated = useId();
  const selectId = id ?? generated;
  const hasPlaceholder = placeholder !== undefined;
  const current = value === undefined ? undefined : (value ?? '');

  const control = (
    <select
      id={selectId}
      name={name}
      required={isRequired}
      disabled={isDisabled}
      aria-invalid={Boolean(error) || undefined}
      {...(current !== undefined ? { value: current } : { defaultValue: defaultValue ?? '' })}
      onChange={e => onChange?.(e.target.value === '' ? null : e.target.value)}
      className={`select-field__input buxa:min-w-0 ${leading ? 'buxa:pl-[32px]!' : ''}`}
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
  );

  // A field-height select with the app's chevron (set in fieldDefaults), the label above it, and the width of its column.
  return (
    <div className={`select-field buxa:grid buxa:gap-[var(--s2)] buxa:min-w-0 ${className ?? ''}`}>
      <label
        className={
          hideLabel
            ? 'sr-only'
            : 'field-label buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--text-2)]'
        }
        htmlFor={selectId}
      >
        {label}
        {isRequired ? ' *' : null}
      </label>
      {leading ? (
        <div className="buxa:relative">
          {leading}
          {control}
        </div>
      ) : (
        control
      )}
      {error ? (
        <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint buxa:text-[length:var(--fs-s)] buxa:text-[var(--text-3)]">{hint}</p>
      ) : null}
    </div>
  );
}
