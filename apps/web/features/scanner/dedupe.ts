/** How long the same code is ignored after it was accepted (a scanner that fires twice, a double Enter). */
export const DUPLICATE_WINDOW_MS = 1500;

export interface ScanDeduper { accept(code: string): boolean; reset(): void }

/**
 * Accepts a code unless the same code was accepted within `windowMs`. A different code is always accepted and becomes the one
 * remembered. `windowMs: Infinity` means "until a different code is seen" (a camera held on one badge).
 */
export function createScanDeduper(windowMs: number = DUPLICATE_WINDOW_MS, now: () => number = Date.now): ScanDeduper {
  let last: { code: string; at: number } | null = null;
  return {
    accept(code) {
      const at = now();
      if (last && last.code === code && at - last.at < windowMs) return false;
      last = { code, at };
      return true;
    },
    reset() { last = null; },
  };
}
