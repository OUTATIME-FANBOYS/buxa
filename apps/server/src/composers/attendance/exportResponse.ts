import 'server-only';
import { toLocalDate } from '@buxa/domain';
import { getRuntime } from '../../runtime';
import { isHttpError } from '../../http/errors';
import { campActor, campClock } from './campActor';
import { parseExportFields, parseLogFilter } from '@buxa/shared';
import { attendanceFileName } from '@buxa/shared';
import { BYTE_ORDER_MARK, csvHeaders, plainText as text } from '@buxa/shared';

/**
 * The CSV download for the attendance log. The filter and the chosen columns come from the query string, and the same rules the page
 * uses apply to both. Permission is the service's: it needs attendance:read and attendance:export and answers 403 otherwise. Times
 * are shown as the table shows them: the camp's zone and the signed-in person's clock. A byte-order mark is written first so
 * spreadsheet programs read accented names correctly.
 */
export async function attendanceExportResponse(url: string): Promise<Response> {
  const actor = await campActor();
  if (!actor) {
    return text('Choose a camp first.', 404);
  }
  const { timeZone, clockFormat } = await campClock(actor);
  const params = Object.fromEntries(new URL(url).searchParams);
  const query = parseLogFilter(params, toLocalDate(new Date(), timeZone));
  if (!query.ok) {
    return text(query.message, 400);
  }
  const fields = parseExportFields(params.fields ?? null);
  if (!fields.ok) {
    return text(fields.message, 400);
  }
  try {
    const csv = await getRuntime().services.attendance.exportCsv(actor, {
      filter: query.filter,
      fields: fields.fields,
      display: { timeZone, clockFormat },
    });

    return new Response(`${BYTE_ORDER_MARK}${csv}`, {
      status: 200,
      headers: csvHeaders(attendanceFileName(query.filter)),
    });
  } catch (error) {
    if (isHttpError(error)) {
      return text(error.message, error.statusCode);
    }
    throw error;
  }
}
