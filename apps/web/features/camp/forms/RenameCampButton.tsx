'use client';

/**
 * CONTRACT between chunks B2 (implements this file) and B1 (renders it on the overview page). Props are frozen.
 * A button that opens the rename dialog and renames the camp through a Server Action. B1 only renders it for roles that may rename.
 * STUB from the planning step: chunk B2 replaces this file.
 */
export function RenameCampButton({ campId, currentName }: { campId: string; currentName: string }) {
  return <button className="btn" disabled data-camp={campId}>Rename {currentName}</button>;
}
