import 'server-only';
import { getRuntime } from '../../../server/runtime';
import { isHttpError } from '../../../server/http/errors';
import { currentActor } from '../people/camp';
import { TEMPLATE_FILE_NAME } from '@buxa/shared';

const PLAIN = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };

/**
 * The blank import template as a CSV download. The service checks classes:manage (a viewer gets 403 and no file). A byte-order mark
 * is written first so spreadsheet programs read accented names correctly.
 */
export async function classTemplateResponse(): Promise<Response> {
  const actor = await currentActor();
  if (!actor) return new Response('Choose a camp first.', { status: 404, headers: PLAIN });
  try {
    const csv = await getRuntime().services.imports.template(actor);
    return new Response(`﻿${csv}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${TEMPLATE_FILE_NAME}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (isHttpError(error)) return new Response(error.message, { status: error.statusCode, headers: PLAIN });
    throw error;
  }
}
