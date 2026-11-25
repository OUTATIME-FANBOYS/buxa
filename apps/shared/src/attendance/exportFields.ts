import {
  ATTENDANCE_FIELD_IDS,
  AttendanceFieldSchema,
  DEFAULT_ATTENDANCE_FIELDS,
  type AttendanceField,
} from '@buxa/contracts';

export type ExportFieldsResult = { ok: true; fields: AttendanceField[] } | { ok: false; message: string };

/** The chosen fields, in the table's column order, without repeats. The CSV and the table share this order. */
export function orderFields(chosen: Iterable<AttendanceField>): AttendanceField[] {
  const set = new Set(chosen);

  return ATTENDANCE_FIELD_IDS.filter(field => set.has(field));
}

/**
 * The CSV's fields from the `fields` parameter: comma-separated field ids. A missing parameter means the default fields. Each name
 * must be a column of the log, and at least one is needed.
 */
export function parseExportFields(raw: string | null): ExportFieldsResult {
  if (raw === null) {
    return { ok: true, fields: orderFields(DEFAULT_ATTENDANCE_FIELDS) };
  }
  const names = raw
    .split(',')
    .map(name => name.trim())
    .filter(name => name !== '');
  const parsed = names.map(name => AttendanceFieldSchema.safeParse(name));
  if (parsed.some(result => !result.success)) {
    return { ok: false, message: 'Choose fields from the list.' };
  }
  const chosen = parsed.flatMap(result => (result.success ? [result.data] : []));
  if (chosen.length === 0) {
    return { ok: false, message: 'Choose at least one field to download.' };
  }

  return { ok: true, fields: orderFields(chosen) };
}
