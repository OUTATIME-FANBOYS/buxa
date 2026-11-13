'use client';

/**
 * CONTRACT between chunks B2 (implements this file) and B1 (renders it). Props are frozen.
 * The create-a-camp form. `first` is the first-run screen (no camps yet); otherwise it creates an extra camp.
 * STUB from the planning step: chunk B2 replaces this file with the real form, driven by a Server Action.
 */
export function NewCampForm({ first }: { first: boolean }) {
  return <p className="muted">New camp form ({first ? 'first run' : 'extra camp'}) is not built yet.</p>;
}
