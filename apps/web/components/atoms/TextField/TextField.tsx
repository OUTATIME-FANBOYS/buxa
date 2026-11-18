'use client';

import { Description } from '@heroui/react/description';
import { FieldError } from '@heroui/react/field-error';
import { Input } from '@heroui/react/input';
import { Label } from '@heroui/react/label';
import { TextField as HeroTextField } from '@heroui/react/textfield';
import type { FocusEvent, KeyboardEvent, ReactNode, Ref } from 'react';

/*
 * A labelled single-line text input. The label is visible unless `hideLabel` (then it is still the accessible name),
 * a validation error replaces the hint, and the error is announced and tied to the input (aria-invalid,
 * aria-describedby) by HeroUI's FieldError. Controlled with `value` and `onChange`, or uncontrolled with `defaultValue`;
 * `name` submits with the form.
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
  return (
    <HeroTextField
      id={id}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      type={type}
      isInvalid={Boolean(error)}
      isRequired={isRequired}
      isDisabled={isDisabled}
      className={className}
      fullWidth
    >
      <Label className={hideLabel ? 'sr-only' : undefined}>{label}</Label>
      <Input
        maxLength={maxLength}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        ref={inputRef}
        onKeyDown={onKeyDown}
        {...inputProps}
        enterKeyHint={enterKeyHint}
        spellCheck={spellCheck}
        autoCapitalize={autoCapitalize}
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? true : undefined}
      />
      {error ? <FieldError>{error}</FieldError> : hint ? <Description>{hint}</Description> : null}
    </HeroTextField>
  );
}
