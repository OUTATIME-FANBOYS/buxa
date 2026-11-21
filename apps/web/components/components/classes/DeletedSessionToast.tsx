'use client';

import { useEffect, useRef } from 'react';
import { useUi } from '@buxa/middleware/providers/UiProvider';

/**
 * Shows Deleted "Name". as a toast when the sessions list opens after a session was deleted (the ?deleted= parameter). It shows
 * once per mount, and renders nothing itself.
 */
export function DeletedSessionToast({ name }: { name: string }) {
  const { toast } = useUi();
  const shown = useRef(false);
  useEffect(() => {
    if (!shown.current) {
      shown.current = true;
      toast(`Deleted "${name}".`);
    }
  }, [name, toast]);

  return null;
}
