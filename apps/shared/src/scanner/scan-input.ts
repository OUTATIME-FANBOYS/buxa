/** What a scanner or keyboard typed, cleaned up: trimmed, or null when there is nothing to scan. */
export function normalizeScan(raw: string): string | null {
  const text = raw.trim();
  return text === '' ? null : text;
}
