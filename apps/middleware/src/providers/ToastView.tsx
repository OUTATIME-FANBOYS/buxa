'use client';

import { useEffect, useRef, useState } from 'react';

/** How long a toast stays on screen: 4 seconds, or 7 when it offers an action (Undo). */
export const TOAST_MS = 4000;
export const ACTION_TOAST_MS = 7000;

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastViewProps {
  message: string;
  tone?: 'error';
  action?: ToastAction;
  /** How long it stays. Defaults to 4 seconds. */
  durationMs?: number;
  /** Called once the toast has closed (its close button, its timer, or its action). */
  onClose?: () => void;
}

/**
 * The one toast in the app: a short confirmation at the bottom of the screen, in liquid glass. It is not a modal, so the page stays
 * usable. It announces itself as a status, has a close button, and closes itself after its time. The provider (UiProvider) renders
 * every toast through this component; a page can also render one directly.
 */
export function ToastView({ message, tone, action, durationMs = TOAST_MS, onClose }: ToastViewProps) {
  const [open, setOpen] = useState(true);
  // The timer reads the latest onClose without restarting when the parent re-renders.
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpen(false);
      latest.current?.();
    }, durationMs);

    return () => window.clearTimeout(timer);
  }, [durationMs]);

  if (!open) {
    return null;
  }

  const close = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <div role="status" className={`toast toast-glass${tone === 'error' ? ' toast-error toast-glass--error' : ''}`}>
      <span>{message}</span>
      {action && (
        <button
          type="button"
          className="toast-glass__action"
          onClick={() => {
            action.run();
            close();
          }}
        >
          {action.label}
        </button>
      )}
      <button type="button" className="toast-glass__close" aria-label="Dismiss notification" onClick={close}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
