'use client';

import { Button } from './Button';

/** Opens the browser's print dialog. The badge's print styles hide everything else. */
export function PrintButton({ label = 'Print badge' }: { label?: string }) {
  return (
    <Button type="button" className="badge-print-btn" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
