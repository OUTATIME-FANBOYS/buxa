'use client';

import { useId, useState, type FocusEvent, type KeyboardEvent, type Ref } from 'react';
import { Icon } from '../Icon';

/*
 * A search box with a search glyph and a clear button. Plain HTML, so the app's own input styling applies and it needs no
 * HeroUI styles. Give it a visible `label` where the box needs one; otherwise `aria-label` names it, and `placeholder` tells
 * sighted users what it searches. `inputRef`, `inputProps` and the keyboard and focus handlers reach the <input> itself, for
 * a parent that runs its own results list (a combobox).
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
  const generated = useId();
  const inputId = id ?? generated;
  const [own, setOwn] = useState(defaultValue ?? '');
  const current = value ?? own;
  const set = (next: string) => {
    setOwn(next);
    onChange?.(next);
  };

  // The glyph sits inside the field on the left, the clear button on the right.
  return (
    <div className={`search-field buxa:grid buxa:gap-[var(--s2)] buxa:min-w-0 ${className ?? ''}`}>
      {label ? (
        <label
          className="field-label buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--text-2)]"
          htmlFor={inputId}
        >
          {label}
        </label>
      ) : null}
      <div className="search-field__box buxa:relative buxa:flex buxa:items-center">
        <span
          className="search-field__icon buxa:absolute buxa:left-[12px] buxa:flex buxa:text-[var(--muted)] buxa:pointer-events-none"
          aria-hidden="true"
        >
          <Icon name="search" size={16} />
        </span>
        <input
          {...inputProps}
          ref={inputRef}
          id={inputId}
          name={name}
          type="search"
          role={inputProps?.role}
          aria-label={label ? undefined : ariaLabel}
          placeholder={placeholder}
          value={current}
          maxLength={maxLength}
          autoComplete={autoComplete ?? 'off'}
          autoFocus={autoFocus}
          disabled={isDisabled}
          onChange={e => set(e.target.value)}
          className="search-field__input buxa:w-full buxa:box-border buxa:pl-[36px]! buxa:pr-[36px]!"
        />
        {current && !isDisabled ? (
          <button
            type="button"
            className="search-field__clear buxa:absolute buxa:right-[6px] buxa:flex buxa:items-center buxa:justify-center buxa:w-[28px] buxa:h-[28px] buxa:rounded-full buxa:text-[var(--muted)]! buxa:hover:bg-[var(--hover)]!"
            aria-label="Clear search"
            onClick={() => set('')}
          >
            <Icon name="x" size={14} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
