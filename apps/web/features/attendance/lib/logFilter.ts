import { AttendanceFilterSchema, type AttendanceFilter } from '@buxa/contracts';

export type LogQuery = { ok: true; filter: AttendanceFilter } | { ok: false; message: string };

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/**
 * The log's filter from URL search parameters. Missing dates default to `today`, the camp's local day. Validation is the contract's
 * schema (real dates, end not before start, a person id that is a uuid), so the screen and the export apply the same rules.
 */
export function parseLogFilter(params: SearchParams, today: string): LogQuery {
  const read = (name: string): string => {
    const value = params[name];
    return typeof value === 'string' ? value.trim() : '';
  };
  const personId = read('personId');
  const parsed = AttendanceFilterSchema.safeParse({
    from: read('from') || today,
    to: read('to') || today,
    ...(personId ? { personId } : {}),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Check the dates.' };
  return { ok: true, filter: parsed.data };
}
