'use client';

import { useCallback, useState } from 'react';
import { RenameCampDialog } from './RenameCampDialog';

/**
 * CONTRACT between chunks B2 (implements this file) and B1 (renders it on the overview page). Props are frozen.
 * A button that opens the rename dialog; the dialog renames the camp through a Server Action. B1 renders it only for roles that may rename.
 */
export function RenameCampButton({ campId, currentName }: { campId: string; currentName: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>Rename</button>
      {open && <RenameCampDialog campId={campId} currentName={currentName} onClose={close} />}
    </>
  );
}
