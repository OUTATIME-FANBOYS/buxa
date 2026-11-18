import { IMPORT_COLUMNS, type RowResult } from '@buxa/domain';
// Relative, not '@/': the root typecheck (scripts/seed-mock imports server/runtime) has no '@/' alias.
import { encodeCsv } from '@buxa/shared';

/*
 * The CSV the owner downloads (the template) and the report of refused rows. Both go through the attendance export's encoder,
 * so quoting and formula neutralisation are the same rule everywhere the camp hands out a CSV.
 */

/** The template: the header row only. A blank file is not imported by accident, so it carries no sample row. */
export function importTemplateCsv(): string {
  return encodeCsv([[...IMPORT_COLUMNS]]);
}

const REPORT_HEADER = ['row', 'field', 'message', 'class_name', 'starts_at', 'ends_at', 'location'];

/** One line per problem on each refused row, so the owner can fix the file row by row. Ready rows are left out. */
export function importErrorReportCsv(results: readonly RowResult[]): string {
  const lines = results.flatMap(r =>
    r.problems.map(p => [r.rowNumber, p.field, p.message, r.className, r.startsAt, r.endsAt, r.location]),
  );

  return encodeCsv([REPORT_HEADER, ...lines]);
}
