'use server';

import { revalidatePath } from 'next/cache';
import { MAX_IMPORT_BYTES } from '@buxa/domain';
import { ROUTES } from '@buxa/shared/config/routes';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { expectedFailure } from '../people/failures';
import { field } from '@buxa/shared';
import type { ImportState } from '@buxa/shared';

/**
 * The bulk import, in two steps on one page. "preview" reads the uploaded file and checks every row; nothing is written.
 * "confirm" takes the same file text back (from the preview form), checks it again against the camp's current data, and writes the
 * ready rows in one transaction. Both steps need classes:manage; the service checks it.
 */
export async function importClassesAction(_previous: ImportState, form: FormData): Promise<ImportState> {
  const actor = await currentActor();
  if (!actor) return { status: 'error', message: 'Choose a camp first.' };

  const confirm = field(form, 'intent') === 'confirm';
  let fileName: string;
  let text: string;
  if (confirm) {
    fileName = field(form, 'fileName');
    text = field(form, 'csv');
    if (text === '') return { status: 'error', message: 'Upload the file again, then confirm.' };
  } else {
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return { status: 'error', message: 'Choose a CSV file to upload.' };
    if (file.size > MAX_IMPORT_BYTES) return { status: 'error', message: 'That file is larger than 1 MB. Split it into smaller files.' };
    fileName = file.name;
    text = await file.text();
  }

  try {
    const services = getRuntime().services.imports;
    const preview = await services.preview(actor, { fileName, text });
    if (!confirm) {
      return { status: 'preview', fileName: preview.fileName, text, counts: preview.counts, results: preview.results };
    }
    const done = await services.confirm(actor, preview);
    revalidatePath(ROUTES.classes);
    return { status: 'done', fileName: done.fileName, counts: done.counts, written: done.written, changedSincePreview: done.changedSincePreview };
  } catch (error) {
    const state = expectedFailure(error, 'Could not read that file.');
    return { status: 'error', message: state.status === 'error' ? state.message : 'Could not read that file.' };
  }
}
