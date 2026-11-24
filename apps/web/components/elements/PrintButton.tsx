'use client';

import { Button } from '../atoms/Button';

/** Opens the browser's print dialog. The badge's and the roster's print styles hide the button itself in print. */
export function PrintButton({
  label = 'Print badge',
  className = 'badge-print-btn',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Button type="button" className={className} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
