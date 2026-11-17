/** Plain-text answers and CSV download headers for the attendance export. Pure: no server, no database. */

const PLAIN_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };

/** A short plain-text answer for the cases where there is no file to send. */
export const plainText = (message: string, status: number): Response => new Response(message, { status, headers: PLAIN_HEADERS });

/** Written first in a CSV so spreadsheet programs read accented names correctly. */
export const BYTE_ORDER_MARK = '﻿';

/** The headers of a CSV download named `fileName`. */
export const csvHeaders = (fileName: string): Record<string, string> => ({
  'Content-Type': 'text/csv; charset=utf-8',
  'Content-Disposition': `attachment; filename="${fileName}"`,
  'Cache-Control': 'no-store',
});
