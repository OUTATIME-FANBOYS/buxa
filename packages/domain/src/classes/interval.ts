/** A stretch of time, as ISO instants. Sessions and enrolments are compared as instants, so the camp zone never changes the answer. */
export interface Span {
  startsAt: string;
  endsAt: string;
}

const ms = (iso: string): number => Date.parse(iso);

/** True when the start is a real time and the end is after it. */
export function isValidSpan(s: Span): boolean {
  const start = ms(s.startsAt);
  const end = ms(s.endsAt);

  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

/**
 * Half-open overlap: [start, end). Two spans that only touch (one ends at 12:00, the next starts at 12:00) do not overlap.
 * Nesting and crossing midnight need no special case, because the comparison is on the whole span.
 */
export function overlaps(a: Span, b: Span): boolean {
  return ms(a.startsAt) < ms(b.endsAt) && ms(b.startsAt) < ms(a.endsAt);
}

/** The first of `others` that clashes with `candidate`, earliest start first, so the same clash is reported every time. */
export function findClash<T extends Span>(candidate: Span, others: readonly T[]): T | null {
  const clashing = others.filter(o => overlaps(candidate, o)).sort((x, y) => ms(x.startsAt) - ms(y.startsAt));

  return clashing[0] ?? null;
}

/**
 * True when any span of `a` overlaps any span of `b`. A series is a list of days, so two series clash when one of their days clashes
 * with one of the other's, not only when their anchor days do.
 */
export function anySpanOverlaps(a: readonly Span[], b: readonly Span[]): boolean {
  return a.some(x => b.some(y => overlaps(x, y)));
}
