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
  isRequired,
  isDisabled,
  id,
}: DatePickerProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const controlled = value !== undefined ? { value: value ?? '' } : { defaultValue: defaultValue ?? '' };

  return (
    <div className="select-field">
      <label className="field-label" htmlFor={inputId}>
        {label}
        {isRequired ? ' *' : null}
      </label>
      <input
        id={inputId}
        name={name}
        type="date"
        required={isRequired}
        disabled={isDisabled}
        min={minValue}
        max={maxValue}
        aria-invalid={Boolean(error) || undefined}
        {...controlled}
        onChange={e => onChange?.(e.target.value === '' ? null : e.target.value)}
        className="select-field__input"
      />
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
