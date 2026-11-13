'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useReducer, useState, type FormEvent, type Reducer } from 'react';
import { suggestSlug } from '@buxa/domain';
import { Field } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { ApiError } from '../api/client';
import { editing, hasErrors, submissionReducer, type Submission, type SubmissionAction } from '../forms/submission';
import { validateNewCamp } from '../forms/validators';
import { useCamp } from '../state/CampProvider';

type FieldName = 'name' | 'slug';
const reducer: Reducer<Submission<FieldName>, SubmissionAction<FieldName>> = submissionReducer;

/** Where the address came from: made from the name until the person types their own. */
interface Draft { name: string; slug: string; slugSource: 'suggested' | 'typed' }

/** Create a camp. `first` is the first-run screen (no camps yet); otherwise it is an extra camp. */
export function NewCamp({ first }: { first: boolean }) {
  const { api, reload, selectOrg } = useCamp();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ name: '', slug: '', slugSource: 'suggested' });
  const [submission, dispatch] = useReducer(reducer, editing<FieldName>());
  const errors = submission.status === 'editing' ? submission.errors : {};

  const onName = (name: string) => setDraft(d => ({ ...d, name, slug: d.slugSource === 'suggested' ? suggestSlug(name) : d.slug }));
  const onSlug = (slug: string) => setDraft(d => ({ ...d, slug: slug.toLowerCase(), slugSource: 'typed' }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateNewCamp(draft);
    if (hasErrors(found)) { dispatch({ type: 'invalid', errors: found }); return; }
    dispatch({ type: 'submit' });
    try {
      const org = await api.createOrg(draft.name.trim(), draft.slug);
      selectOrg(org.id);
      await reload();
      dispatch({ type: 'succeeded' });
      router.push(ROUTES.camp);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) dispatch({ type: 'invalid', errors: { slug: 'That address is taken. Try another.' } });
      else dispatch({ type: 'failed', message: error instanceof ApiError ? error.message : 'Could not create the camp.' });
    }
  };

  const busy = submission.status === 'submitting';
  return (
    <div className={first ? 'setup' : 'page narrow'}>
      <div className="panel">
        <div className="page-title">
          <h1>{first ? 'Set up your camp' : 'New camp'}</h1>
          <p className="muted">{first ? 'You will be its owner. You can add people after this.' : 'You will be the owner of the new camp.'}</p>
        </div>
        <form onSubmit={submit} noValidate className="stack">
          <Field label="Camp name" error={errors.name}><input value={draft.name} onChange={e => onName(e.target.value)} autoFocus maxLength={120} /></Field>
          <Field label="Address" error={errors.slug} hint="Used in links to your camp. Lowercase letters, numbers and dashes.">
            <input value={draft.slug} onChange={e => onSlug(e.target.value)} maxLength={50} /></Field>
          {submission.status === 'failed' && <p className="field-error" role="alert">{submission.message}</p>}
          <div className="row">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create camp'}</button>
            {!first && <Link className="btn" href={ROUTES.camp}>Cancel</Link>}
          </div>
        </form>
      </div>
    </div>
  );
}
