'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dialog } from './Dialog';

interface ToastAction { label: string; run: () => void }
interface Toast { id: number; text: string; tone?: 'error'; action?: ToastAction }
export interface ConfirmOpts { title: string; body?: string; confirmLabel?: string; danger?: boolean }

interface UiCtx {
  toast: (text: string, opts?: { tone?: 'error'; action?: ToastAction }) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  sidebarOpen: boolean; setSidebarOpen: (b: boolean) => void;
}
const Ctx = createContext<UiCtx | null>(null);
export const useUi = () => { const c = useContext(Ctx); if (!c) throw new Error('UiProvider missing'); return c; };

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [queue, setQueue] = useState<(ConfirmOpts & { resolve: (b: boolean) => void })[]>([]);
  const conf = queue[0] ?? null;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const seq = useRef(0);

  const toast = useCallback<UiCtx['toast']>((text, opts) => {
    const id = ++seq.current;
    setToasts(t => [...t.slice(-2), { id, text, ...opts }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts?.action ? 7000 : 4000);
  }, []);
  // Concurrent confirms queue up: every promise settles, one dialog at a time.
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>(resolve => setQueue(q => [...q, { ...o, resolve }])), []);
  const value = useMemo(() => ({ toast, confirm, sidebarOpen, setSidebarOpen }), [toast, confirm, sidebarOpen]);

  const done = (b: boolean) => { conf?.resolve(b); setQueue(q => q.slice(1)); };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => {
          const action = t.action;
          return (
            <div key={t.id} className={`toast ${t.tone === 'error' ? 'toast-error' : ''}`}>
              <span>{t.text}</span>
              {action && <button onClick={() => { action.run(); setToasts(x => x.filter(y => y.id !== t.id)); }}>{action.label}</button>}
            </div>
          );
        })}
      </div>
      {conf && (
        <Dialog title={conf.title} onClose={() => done(false)} footer={<>
          <button className="btn" onClick={() => done(false)}>Cancel</button>
          <button className={`btn ${conf.danger ? 'btn-danger' : 'btn-primary'}`} data-autofocus onClick={() => done(true)}>{conf.confirmLabel ?? 'Confirm'}</button></>}>
          {conf.body && <p className="muted">{conf.body}</p>}
        </Dialog>
      )}
    </Ctx.Provider>
  );
}
