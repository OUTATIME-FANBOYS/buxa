'use client';

import { useState, useTransition } from 'react';
import { useUi } from '@/components/ui';
import { archivePersonAction } from '../actions';

/**
 * Archive behind a confirmation. Archiving hides the person from search and revokes their badge. A refusal (checked in right now) is
 * shown next to the button; success redirects to the list.
 */
export function ArchivePersonButton({ personId, personName }: { personId: string; personName: string }) {
  const { confirm } = useUi();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    const ok = await confirm({
      title: `Archive ${personName}?`,
      body: 'They will be hidden from search and their badge will stop working. Their history is kept.',
      confirmLabel: 'Archive',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      setError(null);
      const state = await archivePersonAction(personId);
      if (state.status === 'error') setError(state.message);
    });
  };

  return (
    <div className="stack">
      <button type="button" className="btn btn-danger-ghost btn-ghost" onClick={onClick} disabled={pending}>
        {pending ? 'Archiving…' : 'Archive person'}
      </button>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
