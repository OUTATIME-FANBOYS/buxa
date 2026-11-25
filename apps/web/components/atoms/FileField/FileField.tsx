'use client';

import { useRef, useState, type Ref } from 'react';
import { Button } from '../Button';

/*
 * A file chooser. The native input is always hidden: the app opens it from its own glass "Choose files" button, so the field
 * looks like the rest of the app. With a `label` it is a labelled field, with its error announced like the other fields and the
 * chosen file names listed under the button. `onChange` receives the chosen files as they are picked.
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
  const own = useRef<HTMLInputElement | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);

  const setRef = (node: HTMLInputElement | null) => {
    own.current = node;
    if (typeof inputRef === 'function') {
      inputRef(node);
    } else if (inputRef) {
      (inputRef as { current: HTMLInputElement | null }).current = node;
    }
  };

  const input = (
    <input
      ref={setRef}
      type="file"
      name={name}
      multiple={multiple}
      accept={accept}
      required={required}
      hidden
      aria-invalid={error ? true : undefined}
      aria-label={label ? undefined : 'Choose files'}
      onChange={event => {
        const files = event.target.files;
        setChosen(files ? Array.from(files, file => file.name) : []);
        onChange?.(files);
      }}
    />
  );

  return (
    <div className="field buxa:grid buxa:gap-[8px] buxa:content-start">
      {label ? (
        <span className="field-label buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--text-2)]">
          {label}
        </span>
      ) : null}
      {input}
      <div className="buxa:flex buxa:flex-wrap buxa:items-center buxa:gap-[12px]">
        <Button variant="secondary" type="button" onClick={() => own.current?.click()}>
          {multiple ? 'Choose files' : 'Choose file'}
        </Button>
        <span className="muted buxa:text-[length:var(--fs-s)]">
          {chosen.length === 0 ? 'No file chosen' : chosen.join(', ')}
        </span>
      </div>
      {error ? (
        <span className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
