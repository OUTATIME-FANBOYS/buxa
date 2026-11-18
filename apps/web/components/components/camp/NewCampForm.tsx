'use client';

import { useActionState, useEffect, useState } from 'react';
import { suggestSlug } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { fieldError, idle } from '@buxa/shared';
import { createCampAction } from '@/actions/camp';
import { TextField, Button } from '@/components/elements/export';

/** Where the address came from: made from the name until the person types their own. */
interface Draft {
  name: string;
  slug: string;
  slugSource: 'suggested' | 'typed';
}

/** Create a camp. `first` is the first-run screen (no camps yet); otherwise it is an extra camp. Works as a plain form without JavaScript. */
export function NewCampForm({ first }: { first: boolean }) {
  const [state, formAction, pending] = useActionState(createCampAction, idle);
  const [draft, setDraft] = useState<Draft>({ name: '', slug: '', slugSource: 'suggested' });

  const onName = (name: string) =>
    setDraft(d => ({ ...d, name, slug: d.slugSource === 'suggested' ? suggestSlug(name) : d.slug }));
  const onSlug = (slug: string) => setDraft(d => ({ ...d, slug: slug.toLowerCase(), slugSource: 'typed' }));
  // The camp's day is the creator's local day. Sent as a hidden field; without JavaScript the server falls back to UTC (editable later).
  const [timezone, setTimezone] = useState('');
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  const formMessage = state.status === 'error' && !state.fieldErrors ? state.message : undefined;

  return (
    <div className={first ? 'setup' : 'page narrow'}>
      <div className="panel">
        <div className="page-title">
          <h1>{first ? 'Set up your camp' : 'New camp'}</h1>
          <p className="muted">
            {first ? 'You will be its owner. You can add people after this.' : 'You will be the owner of the new camp.'}
          </p>
        </div>
        <form action={formAction} className="stack">
          <input type="hidden" name="timezone" value={timezone} />
          <TextField
            label="Camp name"
            name="name"
            value={draft.name}
            onChange={onName}
            error={fieldError(state, 'name')}
            maxLength={120}
            autoFocus
          />
          <TextField
            label="Address"
            name="slug"
            value={draft.slug}
            onChange={onSlug}
            error={fieldError(state, 'slug')}
            maxLength={50}
            hint="Used in links to your camp. Lowercase letters, numbers and dashes."
          />
          {formMessage && (
            <p className="field-error" role="alert">
              {formMessage}
            </p>
          )}
          <div className="row">
            <Button variant="primary" disabled={pending}>
              {pending ? 'Creating…' : 'Create camp'}
            </Button>
            {!first && <Button href={ROUTES.camp}>Cancel</Button>}
          </div>
        </form>
      </div>
    </div>
  );
}
