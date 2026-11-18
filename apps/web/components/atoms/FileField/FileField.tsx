'use client';

import type { Ref } from 'react';

/*
 * A file chooser. Without a `label` the native input stays hidden and the app opens it from a Button through
 * `inputRef.current.click()`. With a `label` it is a visible, labelled field, with its error announced like the other
 * fields. `onChange` receives the chosen files as they are picked.
 */
export interface FileFieldProps {
  label?: string;
  error?: string | null;
  name?: string;
  multiple?: boolean;
  accept?: string;
  required?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange?: (files: FileList | null) => void;
}

export function FileField({
  label,
  error,
  name,
  multiple = false,
  accept,
  required,
  inputRef,
  onChange,
}: FileFieldProps) {
  const input = (
    <input
      ref={inputRef}
      type="file"
      name={name}
      multiple={multiple}
      accept={accept}
      required={required}
      hidden={!label}
      aria-invalid={error ? true : undefined}
      onChange={event => onChange?.(event.target.files)}
    />
  );

  if (!label) {
    return input;
  }

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {input}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
