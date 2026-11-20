'use client';

import { useState } from 'react';
import { Button } from '@/components/elements';
import { AddTeacherDialog } from './AddTeacherDialog';

/** The page-header button that opens the Add a teacher pop-up. The link lives only in that pop-up. */
export function AddTeacherButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="glass" size="header" icon="user-plus" onClick={() => setOpen(true)}>
        Add a teacher
      </Button>
      {open && <AddTeacherDialog onClose={() => setOpen(false)} />}
    </>
  );
}
