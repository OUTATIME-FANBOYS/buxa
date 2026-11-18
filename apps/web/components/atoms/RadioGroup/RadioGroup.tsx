'use client';

import { useId, useState, type ReactNode } from 'react';

/*
 * A set of mutually exclusive choices. Plain HTML (a fieldset of native radio inputs), so the app's own radio styling applies
 * and it needs no HeroUI styles. Arrow keys move between the choices, and the legend is the question a screen reader announces.
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
  error?: string;
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
  const groupName = useId();
  const [own, setOwn] = useState<string | null>(defaultValue ?? null);
  const current = value !== undefined ? value : own;

  return (
    <fieldset className="plain radio-group" aria-invalid={Boolean(error) || undefined} disabled={isDisabled}>
      <legend className="field-label">
        {label}
        {isRequired ? ' *' : null}
      </legend>
      {options.map(option => (
        <label key={option.value} className="radio-option">
          <input
            type="radio"
            name={name ?? groupName}
            value={option.value}
            checked={current === option.value}
            disabled={isDisabled || option.isDisabled}
            onChange={() => {
              setOwn(option.value);
              onChange?.(option.value);
            }}
          />
          <span className="radio-option__text">
            <span className="radio-option__label">{option.label}</span>
            {option.description ? <span className="radio-option__note">{option.description}</span> : null}
          </span>
        </label>
      ))}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
