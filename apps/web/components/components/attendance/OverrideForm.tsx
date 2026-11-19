'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/elements';

interface Props {
  busy: boolean;
  onSubmit: (reason: string) => void;
}

/** An admin's override: a written reason is required, and it is kept on the record with the check-in. */
export function OverrideForm({ busy, onSubmit }: Props) {
  const [reason, setReason] = useState('');
  const fieldId = useId();
  const trimmed = reason.trim();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmed !== '' && !busy) {
      onSubmit(trimmed);
    }
  };

  return (
    <form className="override-form" onSubmit={submit} aria-label="Override this refusal">
      <label className="field buxa:grid buxa:gap-[6px] buxa:content-start" htmlFor={fieldId}>
        <span className="field-label buxa:text-[length:var(--fs-s)] buxa:font-semibold buxa:text-[var(--text-2)]">
          Reason for overriding (required)
        </span>
        <textarea
          id={fieldId}
          rows={3}
          value={reason}
          onChange={event => setReason(event.target.value)}
          maxLength={500}
        />
        <span className="field-hint buxa:text-[length:var(--fs-s)] buxa:text-[var(--text-3)]">
          This is written on the record with the check-in.
        </span>
      </label>
      <Button variant="danger" size="lg" type="submit" icon="check" disabled={busy || trimmed === ''}>
        Check in anyway
      </Button>
    </form>
  );
}
