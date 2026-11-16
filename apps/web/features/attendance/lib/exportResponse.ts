import 'server-only';
import { toLocalDate } from '@buxa/domain';
import { getRuntime } from '@/server/runtime';
import { isHttpError } from '@/server/http/errors';
import { campActor, campZone } from './campActor';
import { parseLogFilter } from './logFilter';
import { attendanceFileName } from './paths';

const PLAIN = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };

/** A short plain-text answer for the cases where there is no file to send. */
const text = (message: string, status: number): Response => new Response(message, { status, headers: PLAIN });

/**
 * The CSV download for the attendance log. Permission is the service's: `exportCsv` needs attendance:export and answers 403 otherwise.
 * The camp's zone decides the default dates. A byte-order mark is written first so spreadsheet programs read accented names correctly.
 */
export async function attendanceExportResponse(url: string): Promise<Response> {
  const actor = await campActor();
  if (!actor) return text('Choose a camp first.', 404);
  const timeZone = await campZone(actor);
  const query = parseLogFilter(Object.fromEntries(new URL(url).searchParams), toLocalDate(new Date(), timeZone));
  if (!query.ok) return text(query.message, 400);
  try {
    const csv = await getRuntime().services.attendance.exportCsv(actor, query.filter);
    return new Response(`﻿${csv}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${attendanceFileName(query.filter)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (isHttpError(error)) return text(error.message, error.statusCode);
    throw error;
  }
}
