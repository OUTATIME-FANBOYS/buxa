import type { ReactNode } from 'react';

interface Props {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  maxLength: number;
  autoFocus?: boolean;
}

/** A labelled text input whose error is announced (`role="alert"`) and tied to the input (`aria-invalid`, `aria-describedby`). */
export function TextField({ label, name, value, onChange, error, hint, maxLength, autoFocus }: Props) {
  const messageId = `${name}-message`;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input name={name} value={value} onChange={event => onChange(event.target.value)} maxLength={maxLength} autoFocus={autoFocus}
        data-autofocus={autoFocus ? true : undefined} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? messageId : undefined} />
      {error ? <span id={messageId} className="field-error" role="alert">{error}</span>
        : hint ? <span id={messageId} className="field-hint">{hint}</span> : null}
    </label>
  );
}
