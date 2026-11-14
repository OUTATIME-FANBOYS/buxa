'use client';

/** Opens the browser's print dialog. The badge's print styles hide everything else. */
export function PrintButton({ label = 'Print badge' }: { label?: string }) {
  return <button type="button" className="btn badge-print-btn" onClick={() => window.print()}>{label}</button>;
}
