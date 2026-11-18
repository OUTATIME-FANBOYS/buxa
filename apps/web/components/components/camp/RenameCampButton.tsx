'use client';

import { useCallback, useState } from 'react';
import { RenameCampDialog } from './RenameCampDialog';
import { Button } from '@/components/elements/export';

/**
 * CONTRACT between chunks B2 (implements this file) and B1 (renders it on the overview page). Props are frozen.
 * A button that opens the rename dialog; the dialog renames the camp through a Server Action. B1 renders it only for roles that may rename.
 */
export function RenameCampButton({ campId, currentName }: { campId: string; currentName: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button type="button" size="header" onClick={() => setOpen(true)}>Rename</Button>
      {open && <RenameCampDialog campId={campId} currentName={currentName} onClose={close} />}
    </>
  );
}
