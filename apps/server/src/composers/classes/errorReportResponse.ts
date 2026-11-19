import 'server-only';
import { MAX_IMPORT_BYTES } from '@buxa/domain';
import { ERROR_REPORT_FILE_NAME } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { isHttpError } from '../../http/errors';
import { currentActor } from '../people/camp';

const PLAIN = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };

/**
 * The refused rows of an import as a CSV download. The file is checked again here, the same way the preview checked it, so the report
 * matches what the owner saw. The service checks classes:manage first: a viewer gets 403 and no file.
 */
export async function classErrorReportResponse(form: FormData): Promise<Response> {
  const actor = await currentActor();
  if (!actor) {
    return new Response('Choose a camp first.', { status: 404, headers: PLAIN });
  }
  const fileName = form.get('fileName');
  const text = form.get('csv');
  if (typeof fileName !== 'string' || typeof text !== 'string' || text === '') {
    return new Response('Upload the file again, then download the report.', { status: 400, headers: PLAIN });
  }
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    return new Response('That file is larger than 1 MB. Split it into smaller files.', { status: 400, headers: PLAIN });
  }
  try {
    const services = getRuntime().services.imports;
    const preview = await services.preview(actor, { fileName, text });
    const csv = await services.errorReport(actor, preview);

    return new Response(`﻿${csv}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${ERROR_REPORT_FILE_NAME}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (isHttpError(error)) {
      return new Response(error.message, { status: error.statusCode, headers: PLAIN });
    }
    throw error;
  }
}
