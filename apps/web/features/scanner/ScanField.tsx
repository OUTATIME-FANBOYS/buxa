'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createScanDeduper } from './dedupe';
import { normalizeScan } from './scan-input';

/**
 * One focused text input that accepts a handheld scanner (it types the code and presses Enter) or typing. Calls `onScan` with the raw
 * text, then clears itself and takes focus back. `status` is an optional live region for the result of the last scan.
 */
export interface ScanFieldProps { onScan: (raw: string) => void; label: string; disabled?: boolean; status?: ReactNode }

/** Lets a parent put focus back in the field (for example after its screen clears for the next person). Does nothing while disabled. */
export interface ScanFieldHandle { focus: () => void }

export const ScanField = forwardRef<ScanFieldHandle, ScanFieldProps>(function ScanField({ onScan, label, disabled, status }, handle) {
  const input = useRef<HTMLInputElement>(null);
  const [dedupe] = useState(() => createScanDeduper());
  const focus = useCallback(() => { if (!disabled) input.current?.focus(); }, [disabled]);
  useImperativeHandle(handle, () => ({ focus }), [focus]);

  useEffect(() => {
    focus();
    // A scanner only works while the field has focus: take it back when the user taps elsewhere on the page.
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget;
      if (next instanceof HTMLElement && next.matches('input, textarea, select, button, a, [contenteditable]')) return;
      setTimeout(focus, 0);
    };
    document.addEventListener('focusout', onFocusOut);
    return () => document.removeEventListener('focusout', onFocusOut);
  }, [focus]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = normalizeScan(input.current?.value ?? '');
    if (input.current) input.current.value = '';
    focus();
    if (text !== null && dedupe.accept(text)) onScan(text);
  }

  return (
    <form className="scan-field" onSubmit={submit}>
      <label className="scan-label" htmlFor="scan-code">{label}</label>
      <input
        id="scan-code" ref={input} name="code" className="scan-input" type="text" inputMode="text" enterKeyHint="go"
        disabled={disabled} autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
      />
      <div className="scan-status" role="status" aria-live="polite">{status}</div>
    </form>
  );
});
