'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/elements';

/** How long a toast stays on screen before it closes itself. */
export const TOAST_MS = 4000;

/**
 * A short confirmation at the bottom of the screen, in liquid glass. It is not a modal: the page stays usable and nothing needs an
 * answer. It closes on its close button or after 4 seconds. Render it with a key that changes for each message, so a second message
 * shows again after the first has closed.
 */
export function Toast({ message }: { message: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), TOAST_MS);

    return () => window.clearTimeout(timer);
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div className="toast-glass" role="status">
      <span>{message}</span>
      <Button
        type="button"
        variant="glass"
        size="sm"
        iconOnly
        icon="x"
        aria-label="Close message"
        onClick={() => setOpen(false)}
      />
    </div>
  );
}
