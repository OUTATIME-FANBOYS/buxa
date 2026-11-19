'use client';

import { useId, type ReactNode } from 'react';

/*
 * A labelled date and time. Plain HTML: a native datetime-local input, whose value is exactly the YYYY-MM-DDTHH:MM string the
 * server parses (the time is read in the camp's own zone, which the form says above the fields). Uncontrolled: it submits with
 * the form through `name`, and starts from `defaultValue`.
 */
export interface DateTimeFieldProps {
  label: string;
  name: string;
  defaultValue?: string | null;
  /** Validation message. When set the field is invalid and the message replaces the hint. */
  error?: string | null;
  hint?: ReactNode;
  isRequired?: boolean;
  id?: string;
  autoFocus?: boolean;
}

export function DateTimeField({
  label,
  name,
  defaultValue,
  error,
  hint,
  isRequired,
  id,
  autoFocus,
}: DateTimeFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;

  return (
    <div className="select-field buxa:grid buxa:gap-[var(--s2)] buxa:min-w-0">
      <label
        className="field-label buxa:text-[length:var(--fs-b)] buxa:font-semibold buxa:text-[var(--text-2)]"
        htmlFor={inputId}
      >
        {label}
        {isRequired ? ' *' : null}
      </label>
      <input
        id={inputId}
        name={name}
        type="datetime-local"
        required={isRequired}
        autoFocus={autoFocus}
        defaultValue={defaultValue ?? ''}
        aria-invalid={Boolean(error) || undefined}
        className="select-field__input buxa:min-w-0"
      />
      {error ? (
        <p className="field-error buxa:text-[length:var(--fs-b)] buxa:text-[var(--crit)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint buxa:text-[length:var(--fs-b)] buxa:text-[var(--text-3)]">{hint}</p>
      ) : null}
    </div>
  );
}
