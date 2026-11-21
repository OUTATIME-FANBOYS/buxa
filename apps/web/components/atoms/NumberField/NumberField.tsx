'use client';

import { useId, useState, type ReactNode } from 'react';

/*
 * A labelled numeric input with no steppers, for counts, ages and capacities. Plain HTML: a native number input whose
 * spinner is hidden. Its value is a number, or NaN while the field is empty; `name` submits the digits, so a server form
 * still reads a string.
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
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const [own, setOwn] = useState<number | undefined>(defaultValue);
  const current = value ?? own;

  return (
    <div className="buxa:grid buxa:min-w-0 buxa:gap-2">
      <label className="field-label" htmlFor={inputId}>
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
        type="number"
        inputMode="numeric"
        value={current === undefined || Number.isNaN(current) ? '' : current}
        min={minValue}
        max={maxValue}
        placeholder={placeholder}
        required={isRequired}
        aria-required={isRequired || undefined}
        disabled={isDisabled}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error || hint ? hintId : undefined}
        onChange={e => {
          const next = e.target.value === '' ? Number.NaN : Number(e.target.value);
          setOwn(next);
          onChange?.(next);
        }}
        className="buxa:box-border buxa:h-[var(--control-h)] buxa:w-full buxa:min-w-0 buxa:rounded-[var(--r-1)] buxa:border buxa:border-[var(--line)] buxa:bg-[var(--surface)] buxa:px-3 buxa:font-[inherit] buxa:text-[var(--text)] buxa:outline-none buxa:aria-[invalid=true]:border-[var(--crit)] buxa:disabled:opacity-60 buxa:disabled:cursor-not-allowed buxa:[appearance:textfield] buxa:[&::-webkit-inner-spin-button]:appearance-none buxa:[&::-webkit-outer-spin-button]:appearance-none"
      />
      {error ? (
        <p id={hintId} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
