'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ACTION_TOAST_MS, TOAST_MS, ToastView, type ToastAction } from './ToastView';

/**
 * The props the confirm prompt needs. The web app passes its ConfirmDialog in, so this package never imports the web app. The
 * prompt owns its layout (title, body, footer); this package only says what to ask.
 */
export interface ConfirmDialogProps {
  title: string;
  body?: string;
  variant: 'danger' | 'neutral';
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

interface Toast {
  id: number;
  text: string;
  tone?: 'error';
  action?: ToastAction;
}
export interface ConfirmOpts {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface UiCtx {
  toast: (text: string, opts?: { tone?: 'error'; action?: ToastAction }) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  sidebarOpen: boolean;
  setSidebarOpen: (b: boolean) => void;
}
const Ctx = createContext<UiCtx | null>(null);
export const useUi = () => {
  const c = useContext(Ctx);
  if (!c) {
    throw new Error('UiProvider missing');
  }

  return c;
};

export function UiProvider({ children, Dialog }: { children: ReactNode; Dialog: ComponentType<ConfirmDialogProps> }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [queue, setQueue] = useState<(ConfirmOpts & { resolve: (b: boolean) => void })[]>([]);
  const conf = queue[0] ?? null;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const seq = useRef(0);

  // One toast component for the whole app: the provider keeps the queue, and each toast closes itself after its time.
  const toast = useCallback<UiCtx['toast']>((text, opts) => {
    const id = ++seq.current;
    setToasts(t => [...t.slice(-2), { id, text, ...opts }]);
  }, []);
  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  // Concurrent confirms queue up: every promise settles, one dialog at a time.
  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>(resolve => setQueue(q => [...q, { ...o, resolve }])),
    [],
  );
  const value = useMemo(() => ({ toast, confirm, sidebarOpen, setSidebarOpen }), [toast, confirm, sidebarOpen]);

  const done = (b: boolean) => {
    conf?.resolve(b);
    setQueue(q => q.slice(1));
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map(t => (
          <ToastView
            key={t.id}
            message={t.text}
            tone={t.tone}
            action={t.action}
            durationMs={t.action ? ACTION_TOAST_MS : TOAST_MS}
            onClose={() => dismiss(t.id)}
          />
        ))}
      </div>
      {conf && (
        <Dialog
          title={conf.title}
          body={conf.body}
          variant={conf.danger ? 'danger' : 'neutral'}
          confirmLabel={conf.confirmLabel ?? 'Confirm'}
          onCancel={() => done(false)}
          onConfirm={() => done(true)}
        />
      )}
    </Ctx.Provider>
  );
}
