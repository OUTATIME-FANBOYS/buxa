'use client';

import { useId, type ReactNode } from 'react';

/*
 * A labelled date. Plain HTML: a native date input, styled by the app's own field rules, and the device's own picker.
 * The value is a YYYY-MM-DD string (or null/'' when empty), so it crosses from the server to the page unchanged: a date
 * object cannot be passed from a server component to a client component.
 */
export interface DatePickerProps {
  label: string;
  name?: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  minValue?: string;
  maxValue?: string;
  error?: string | null;
  hint?: ReactNode;
  /** The id of text that lives outside this field and describes it (for example a note set above the field). Joined to its own hint. */
  describedBy?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  id?: string;
}

export function DatePicker({
  label,
  name,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  error,
  hint,
  describedBy,
  isRequired,
  isDisabled,
  id,
}: DatePickerProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const controlled = value !== undefined ? { value: value ?? '' } : { defaultValue: defaultValue ?? '' };

  return (
    <div className="select-field buxa:grid buxa:gap-[var(--s2)] buxa:min-w-0">
      <label
        className="field-label buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--text-2)]"
        htmlFor={inputId}
      >
        {label}
        {isRequired ? (
          <span className="field-required" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>
      <input
        id={inputId}
        name={name}
        type="date"
        required={isRequired}
        aria-required={isRequired || undefined}
        disabled={isDisabled}
        min={minValue}
        max={maxValue}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[describedBy, error || hint ? hintId : undefined].filter(Boolean).join(' ') || undefined}
        {...controlled}
        onChange={e => onChange?.(e.target.value === '' ? null : e.target.value)}
        className="select-field__input buxa:min-w-0 buxa:aria-[invalid=true]:border-[var(--crit)]"
      />
      {error ? (
        <p id={hintId} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="field-hint buxa:text-[length:var(--fs-s)] buxa:text-[var(--text-3)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
