'use client';

/**
 * One focused text input that accepts a handheld scanner (it types the code and presses Enter) or typing. Calls `onScan` with the raw
 * text, then clears itself. Frozen props; chunk P5 builds the real one (autofocus, refocus after each scan, no autocorrect).
 */
export interface ScanFieldProps { onScan: (raw: string) => void; label: string; disabled?: boolean }

export function ScanField({ onScan, label, disabled }: ScanFieldProps) {
  return (
    <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); onScan(String(f.get('code') ?? '')); e.currentTarget.reset(); }}>
      <label>{label}<input name="code" disabled={disabled} autoComplete="off" /></label>
    </form>
  );
}
