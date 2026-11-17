import 'server-only';
import { toLocalDate } from '@buxa/domain';
import { getRuntime } from '../../runtime';
import { isHttpError } from '../../http/errors';
import { campActor, campZone } from './campActor';
import { parseLogFilter } from '@buxa/shared';
import { attendanceFileName } from '@buxa/shared';
import { BYTE_ORDER_MARK, csvHeaders, plainText as text } from '@buxa/shared';

/**
 * The CSV download for the attendance log. Permission is the service's: `exportCsv` needs attendance:export and answers 403 otherwise.
 * The camp's zone decides the default dates. A byte-order mark is written first so spreadsheet programs read accented names correctly.
 */
export async function attendanceExportResponse(url: string): Promise<Response> {
  const actor = await campActor();
  if (!actor) {
    return text('Choose a camp first.', 404);
  }
  const timeZone = await campZone(actor);
  const query = parseLogFilter(Object.fromEntries(new URL(url).searchParams), toLocalDate(new Date(), timeZone));
  if (!query.ok) {
    return text(query.message, 400);
  }
  try {
    const csv = await getRuntime().services.attendance.exportCsv(actor, query.filter);

    return new Response(`${BYTE_ORDER_MARK}${csv}`, { status: 200, headers: csvHeaders(attendanceFileName(query.filter)) });
  } catch (error) {
    if (isHttpError(error)) {
      return text(error.message, error.statusCode);
    }
    throw error;
  }
}
