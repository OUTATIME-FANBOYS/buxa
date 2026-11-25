import { AttendanceFilterSchema, type AttendanceFilter } from '@buxa/contracts';

export type LogQuery = { ok: true; filter: AttendanceFilter } | { ok: false; message: string };

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** The optional filter parts, by their URL names. A blank value is the same as no value (the "All" or "Any" choice). */
const OPTIONAL_PARTS = ['personId', 'sessionId', 'classId', 'method', 'checkedInBy', 'status'] as const;

/**
 * The log's filter from URL search parameters. Missing dates default to `today`, the camp's local day. Validation is the contract's
 * schema (real dates, end not before start, ids that are uuids, known methods and statuses), so the screen and the export apply the
 * same rules.
 */
export function parseLogFilter(params: SearchParams, today: string): LogQuery {
  const read = (name: string): string => {
    const value = params[name];

    return typeof value === 'string' ? value.trim() : '';
  };
  const optional = Object.fromEntries(
    OPTIONAL_PARTS.map(name => [name, read(name)] as const).filter(([, value]) => value !== ''),
  );
  const parsed = AttendanceFilterSchema.safeParse({
    from: read('from') || today,
    to: read('to') || today,
    ...optional,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the dates.' };
  }

  return { ok: true, filter: parsed.data };
}
