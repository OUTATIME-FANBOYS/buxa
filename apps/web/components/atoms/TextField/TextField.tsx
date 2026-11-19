'use client';

import { useId, useState, type FocusEvent, type KeyboardEvent, type ReactNode, type Ref } from 'react';

/*
 * A labelled single-line text input. Plain HTML: the label is visible unless `hideLabel` (then it is still the accessible name),
 * a validation error replaces the hint and is announced, and the input is marked invalid. Controlled with `value` and
 * `onChange`, or uncontrolled with `defaultValue`; `name` submits with the form.
 */
export interface TextFieldProps {
  label: string;
  /** Hide the visible label. Use only where the surrounding text already says what the field is. */
  hideLabel?: boolean;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Validation message. When set the field is invalid and the message replaces the hint. */
  error?: string | null;
  /** Helper text shown under the field while there is no error. */
  hint?: ReactNode;
  type?: 'text' | 'email' | 'tel' | 'password' | 'url';
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'search' | 'url' | 'none';
  autoFocus?: boolean;
  isRequired?: boolean;
  isDisabled?: boolean;
  id?: string;
  /** The underlying input element, for a parent that moves focus (a scanner field). */
  inputRef?: Ref<HTMLInputElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Attributes for an input that a parent wires up itself (a datalist suggestion list, a blur handler). */
  inputProps?: { list?: string; onBlur?: (event: FocusEvent<HTMLInputElement>) => void };
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'search' | 'send';
  spellCheck?: boolean;
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  className?: string;
}

export function TextField({
  label,
  hideLabel = false,
  name,
  value,
  defaultValue,
  onChange,
  error,
  hint,
  type = 'text',
  maxLength,
  minLength,
  placeholder,
  autoComplete,
  inputMode,
  autoFocus,
  isRequired,
  isDisabled,
  id,
  inputRef,
  onKeyDown,
  inputProps,
  enterKeyHint,
  spellCheck,
  autoCapitalize,
  className,
}: TextFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const [own, setOwn] = useState(defaultValue ?? '');
  const current = value ?? own;

  return (
    <div className={`buxa:grid buxa:min-w-0 buxa:gap-2 ${className ?? ''}`}>
      <label className={hideLabel ? 'sr-only' : 'field-label'} htmlFor={inputId}>
        {label}
        {isRequired ? ' *' : null}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type={type}
        value={current}
        maxLength={maxLength}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoFocus={autoFocus}
        required={isRequired}
        disabled={isDisabled}
        spellCheck={spellCheck}
        autoCapitalize={autoCapitalize}
        enterKeyHint={enterKeyHint}
        data-autofocus={autoFocus ? true : undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error || hint ? hintId : undefined}
        list={inputProps?.list}
        onBlur={inputProps?.onBlur}
        onKeyDown={onKeyDown}
        onChange={e => {
          setOwn(e.target.value);
          onChange?.(e.target.value);
        }}
        className="buxa:box-border buxa:h-[var(--control-h)] buxa:w-full buxa:min-w-0 buxa:rounded-[var(--r-1)] buxa:border buxa:border-[var(--line)] buxa:bg-[var(--surface)] buxa:px-3 buxa:font-[inherit] buxa:text-[var(--text)] buxa:outline-none focus-visible:buxa:outline-2 focus-visible:buxa:outline-[var(--focus)] aria-[invalid=true]:buxa:border-[var(--crit)] disabled:buxa:opacity-60 disabled:buxa:cursor-not-allowed"
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
