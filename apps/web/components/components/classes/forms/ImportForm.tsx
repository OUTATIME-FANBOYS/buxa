'use client';

import { useActionState, useRef } from 'react';
import { Field } from '@/components/elements/export';
import { IMPORT_IDLE } from '@buxa/shared';
import { importClassesAction } from '@/actions/classes';
import { ImportResults } from './ImportResults';
import { ErrorReportButton } from './ErrorReportButton';

/**
 * Upload a filled template, read the preview, then confirm. Nothing is saved until the confirm button is pressed. The confirm writes
 * only the ready rows; refused rows are skipped and named in the preview.
 */
export function ImportForm() {
  const [state, formAction, pending] = useActionState(importClassesAction, IMPORT_IDLE);
  const uploadRef = useRef<HTMLFormElement>(null);

  return (
    <div className="stack classes-import">
      <form ref={uploadRef} action={formAction} className="panel stack" aria-labelledby="import-upload-heading">
        <h2 id="import-upload-heading" className="people-subheading">1. Upload a filled template</h2>
        <p className="muted">Use the template so the column names match. The file must be a CSV, up to 1 MB.</p>
        <Field label="CSV file *">
          <input type="file" name="file" accept=".csv,text/csv" required />
        </Field>
        <input type="hidden" name="intent" value="preview" />
        <div className="classes-actions">
          <button type="submit" className="btn btn-primary classes-target" disabled={pending}>{pending ? 'Checking...' : 'Check the file'}</button>
        </div>
      </form>

      {state.status === 'error' && <p role="alert" className="field-error">{state.message}</p>}

      {state.status === 'preview' && (
        <div className="panel stack" aria-busy={pending}>
          <ImportResults results={state.results} counts={state.counts} />
          <ErrorReportButton fileName={state.fileName} text={state.text} refused={state.counts.refused} />
          <form action={formAction} className="classes-actions" aria-label="Confirm the import">
            <input type="hidden" name="intent" value="confirm" />
            <input type="hidden" name="fileName" value={state.fileName} />
            <input type="hidden" name="csv" value={state.text} />
            <button type="submit" className="btn btn-primary classes-target" disabled={pending || state.counts.create + state.counts.update === 0}>
              {pending ? 'Saving...' : `Save ${state.counts.create + state.counts.update} ready rows`}
            </button>
            <span className="muted">Refused rows are not saved. Fix them in the file and check it again.</span>
          </form>
        </div>
      )}

      {state.status === 'done' && (
        <div className="panel stack" role="status">
          <h2 className="people-subheading">Import saved</h2>
          <p>{state.fileName}: {state.written} sessions saved. {state.counts.refused} rows were refused and not saved.</p>
          {state.changedSincePreview && (
            <p className="field-error">The camp&apos;s sessions changed after the preview, so some rows may have a different result from what you saw. Check the schedule.</p>
          )}
        </div>
      )}
    </div>
  );
}
