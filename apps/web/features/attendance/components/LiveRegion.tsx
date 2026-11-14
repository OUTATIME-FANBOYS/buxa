/** Speaks a short message to screen readers when it changes. Visually hidden; the visible text is elsewhere on the screen. */
export function LiveRegion({ message }: { message: string }) {
  return <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</div>;
}
