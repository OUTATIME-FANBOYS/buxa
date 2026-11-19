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
    // One choice per row: the native radio, then the label; the question is the legend. The name, with its note on the line
    // below in a smaller, muted size.
    <fieldset
      className="plain radio-group buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s3)]"
      aria-invalid={Boolean(error) || undefined}
      disabled={isDisabled}
    >
      <legend className="field-label buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--text-2)] buxa:p-0 buxa:mb-[var(--s2)]">
        {label}
        {isRequired ? ' *' : null}
      </legend>
      {options.map(option => (
        <label
          key={option.value}
          className="radio-option buxa:flex buxa:items-center buxa:gap-[var(--s2)] buxa:cursor-pointer"
        >
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
          <span className="radio-option__text buxa:flex buxa:flex-col buxa:gap-[2px] buxa:min-w-0">
            <span className="radio-option__label buxa:text-[length:var(--fs-m,15px)] buxa:leading-[1.4]">
              {option.label}
            </span>
            {option.description ? (
              <span className="radio-option__note buxa:text-[length:var(--fs-s,13px)] buxa:leading-[1.4] buxa:text-[var(--muted)]">
                {option.description}
              </span>
            ) : null}
          </span>
        </label>
      ))}
      {error ? (
        <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
