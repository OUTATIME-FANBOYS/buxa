'use client';

import { useId, useState, type ReactNode } from 'react';

/*
 * A single on/off choice with its label. Plain HTML: a native checkbox, styled by the app's own rules, so it needs no HeroUI
 * styles. `name` and `value` submit with the form when checked, as a native checkbox does.
 * Controlled with `isSelected` and `onChange`, or uncontrolled with `defaultSelected`.
 */
export interface CheckboxProps {
  children: ReactNode;
  name?: string;
  value?: string;
  isSelected?: boolean;
  defaultSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  className?: string;
}

export function Checkbox({
  children,
  name,
  value,
  isSelected,
  defaultSelected,
  onChange,
  isDisabled,
  isRequired,
  isInvalid,
  className,
}: CheckboxProps) {
  const [own, setOwn] = useState(defaultSelected ?? false);
  const checked = isSelected ?? own;
  const id = useId();

  return (
    <label className={`check-field ${className ?? ''}`} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        required={isRequired}
        disabled={isDisabled}
        aria-invalid={isInvalid || undefined}
        onChange={e => {
          setOwn(e.target.checked);
          onChange?.(e.target.checked);
        }}
      />
      <span className="check-field__label">{children}</span>
    </label>
  );
}
