'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import type { Priority, User } from '../types';
import { PRIORITY_LABEL, PRIORITIES, initials } from '../lib/tasks';
import { project as projectMotion, reduceMotion, rubberband, springAnimate, VelocityTracker } from '../lib/motion';

/* ---------- Tones, pills ---------- */
/** The five-colour system. A tone always travels with a text label, never colour alone. */
export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'crit' | 'agent';
export const KIND_TONE: Record<'open' | 'active' | 'done', Tone> = { open: 'neutral', active: 'brand', done: 'ok' };
export function Pill({ tone = 'neutral', children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={`pill pill-${tone}`}>{dot && <i className="pill-dot" aria-hidden="true" />}{children}</span>;
}
const AVATAR_HUES = ['brand', 'ok', 'warn', 'neutral'] as const;
const hueOf = (name: string) => AVATAR_HUES[Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];

/* ---------- Avatar & priority ---------- */
export function Avatar({ user, size = 24 }: { user?: Pick<User, 'name' | 'agent'> | null; size?: number }) {
  if (!user) return <span className="avatar avatar-empty" style={{ width: size, height: size }} title="Unassigned"><Icon name="user" size={size * 0.55} /></span>;
  if (user.agent) return <span className="avatar avatar-agent" style={{ width: size, height: size }} title={`${user.name} (agent)`} aria-label={`${user.name}, agent`}><Icon name="agent" size={size * 0.55} /></span>;
  return <span className={`avatar avatar-${hueOf(user.name)}`} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.42) }} title={user.name} aria-label={user.name}>{initials(user.name)}</span>;
}

export function PriorityMark({ priority, label = false }: { priority: Priority; label?: boolean }) {
  const n = PRIORITIES.indexOf(priority) + 1;
  return (
    <span className={`prio prio-${priority}`} title={`${PRIORITY_LABEL[priority]} priority`}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        {[0, 1, 2, 3].map(i => <rect key={i} x={1 + i * 3.4} y={10 - i * 2.6} width="2.2" height={3 + i * 2.6} rx="1" opacity={i < n ? 1 : 0.22} fill="currentColor" />)}
      </svg>
      {label ? <span>{PRIORITY_LABEL[priority]}</span> : <span className="sr-only">{PRIORITY_LABEL[priority]} priority</span>}
    </span>
  );
}

/* ---------- Popover & Menu ---------- */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Popover({ anchor, onClose, align = 'start', width, children, label, className = '' }: {
  anchor: HTMLElement | null; onClose: () => void; align?: 'start' | 'end'; width?: number; children: ReactNode; label?: string; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = anchor.getBoundingClientRect(); const h = ref.current.offsetHeight; const w = ref.current.offsetWidth;
    let top = r.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
    let left = align === 'end' ? r.right - w : r.left; left = Math.min(Math.max(8, left), innerWidth - w - 8);
    const above = top < r.top;
    setPos({ top, left, origin: `${Math.round(r.left + r.width / 2 - left)}px ${above ? h : 0}px` });
  }, [anchor, align, children]);

  useEffect(() => {
    const down = (e: MouseEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !anchor?.contains(t)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); anchor?.focus(); } };
    const scroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key, true);
    addEventListener('scroll', scroll, true); addEventListener('resize', onClose);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); removeEventListener('scroll', scroll, true); removeEventListener('resize', onClose); };
  }, [anchor, onClose]);

  useEffect(() => { ref.current?.querySelector<HTMLElement>('[data-autofocus],[role=menuitem],input,button')?.focus(); }, []);

  return createPortal(
    <div ref={ref} className={`popover ${className}`} role="dialog" aria-label={label} style={{ top: pos?.top ?? -999, left: pos?.left ?? -999, width, transformOrigin: pos?.origin, visibility: pos ? 'visible' : 'hidden' }}>
      {children}
    </div>, document.body);
}

export interface MenuItem { label: string; icon?: string; onSelect: () => void; danger?: boolean; divider?: boolean; disabled?: boolean; checked?: boolean }

export function Menu({ label, trigger, items, align = 'end', className = 'icon-btn' }: {
  label: string; trigger: ReactNode; items: (MenuItem | false | null)[]; align?: 'start' | 'end'; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const list = items.filter(Boolean) as MenuItem[];
  const onKey = (e: React.KeyboardEvent) => {
    const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])'));
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
  };
  return (
    <>
      <button ref={btn} type="button" className={className} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        onKeyDown={e => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}>
        {trigger}
      </button>
      {open && (
        <Popover anchor={btn.current} onClose={close} align={align} label={label} className="menu">
          <div role="menu" aria-label={label} onKeyDown={onKey} onClick={e => e.stopPropagation()}>
            {list.map((it, i) => it.divider ? <hr key={i} /> : (
              <button key={i} role="menuitem" type="button" disabled={it.disabled} className={it.danger ? 'danger' : ''}
                onClick={() => { close(); btn.current?.focus(); it.onSelect(); }}>
                {it.icon ? <Icon name={it.icon} size={15} /> : <span style={{ width: 15 }} />}
                <span>{it.label}</span>
                {it.checked && <Icon name="check" size={14} className="menu-check" />}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}

/* ---------- Dialog / Drawer ---------- */
export function Dialog({ title, onClose, children, footer, drawer = false, wide = false, labelledBy }: {
  title?: string; onClose: () => void; children: ReactNode | ((close: () => void) => ReactNode); footer?: ReactNode; drawer?: boolean; wide?: boolean; labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null); const scrim = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const exitTimer = useRef<number | undefined>(undefined);
  const swipe = useRef<{ id: number; x0: number; x: number; on: boolean; vel: VelocityTracker; cancel?: () => void } | null>(null);

  // Leave the way we came: the exit mirrors the entrance.
  const close = useCallback(() => {
    if (leaving) return;
    if (reduceMotion()) { onClose(); return; }
    setLeaving(true); exitTimer.current = window.setTimeout(onClose, 190);
  }, [leaving, onClose]);
  // If the parent unmounts us first (e.g. after delete), nothing may fire afterwards.
  useEffect(() => () => { window.clearTimeout(exitTimer.current); swipe.current?.cancel?.(); }, []);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; prev?.focus?.(); };
  }, []);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const f = Array.from(ref.current!.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  // Drawer: grab the header and drag. 1:1 tracking, rubber-band on the far side, momentum-projected dismiss.
  const onPD = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawer) return; const t = e.target as HTMLElement;
    if (!t.closest('[data-sheet-handle]') || t.closest('button,a,input,select,textarea,[role=menu]')) return;
    swipe.current?.cancel?.();
    swipe.current = { id: e.pointerId, x0: e.clientX, x: 0, on: false, vel: new VelocityTracker() }; swipe.current.vel.push(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPM = (e: React.PointerEvent<HTMLDivElement>) => {
    const w = swipe.current; if (!w || e.pointerId !== w.id || !ref.current) return;
    const dx = e.clientX - w.x0; if (!w.on && Math.abs(dx) < 8) return; w.on = true;
    const width = ref.current.offsetWidth; w.x = dx >= 0 ? dx : -rubberband(-dx, width);
    ref.current.style.translate = `${w.x}px 0`; if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - w.x / width));
    w.vel.push(e.clientX);
  };
  const onPU = (e: React.PointerEvent<HTMLDivElement>) => {
    const w = swipe.current; if (!w || e.pointerId !== w.id || !ref.current) return;
    if (!w.on) { swipe.current = null; return; }
    const el = ref.current; const width = el.offsetWidth; const v = w.vel.get()[0];
    const dismiss = w.x > 0 && (w.x + projectMotion(v) > width * 0.5 || v > 700);
    const apply = (x: number) => { el.style.translate = `${x}px 0`; if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - x / width)); };
    w.cancel = springAnimate({ from: [w.x], to: [dismiss ? width : 0], velocity: [v], damping: dismiss ? 1 : Math.abs(v) > 500 ? 0.8 : 1, response: 0.34,
      onFrame: p => apply(p[0]), onDone: () => { swipe.current = null; if (dismiss) onClose(); else { el.style.translate = ''; if (scrim.current) scrim.current.style.opacity = ''; } } });
  };

  return createPortal(
    <CloseCtx.Provider value={close}>
      <div ref={scrim} className={`scrim ${drawer ? 'scrim-drawer' : ''} ${leaving ? 'leaving' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
        <div ref={ref} role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy}
          className={`${drawer ? 'drawer' : 'dialog'} ${wide ? 'dialog-wide' : ''} ${leaving ? 'leaving' : ''}`} onKeyDown={onKey}
          onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU}>
          {title && !drawer && <header className="dialog-head"><h2>{title}</h2><button className="icon-btn" onClick={close} aria-label="Close"><Icon name="x" /></button></header>}
          <div className={drawer ? 'drawer-body' : 'dialog-body'}>{typeof children === 'function' ? children(close) : children}</div>
          {footer && <footer className="dialog-foot">{footer}</footer>}
        </div>
      </div>
    </CloseCtx.Provider>, document.body);
}
const CloseCtx = createContext<() => void>(() => {});
export const useDialogClose = () => useContext(CloseCtx);

/* ---------- Toasts & confirm: UiProvider ---------- */
interface Toast { id: number; text: string; tone?: 'error'; action?: { label: string; run: () => void } }
interface ConfirmOpts { title: string; body?: string; confirmLabel?: string; danger?: boolean }
interface TaskDrawerState { id: string | 'new'; defaults?: { columnId?: string; due?: string; projectId?: string } }
interface UiCtx {
  toast: (text: string, opts?: { tone?: 'error'; action?: Toast['action'] }) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  drawer: TaskDrawerState | null;
  openTask: (id: string | 'new', defaults?: TaskDrawerState['defaults']) => void;
  closeTask: () => void;
  sidebarOpen: boolean; setSidebarOpen: (b: boolean) => void;
}
const Ctx = createContext<UiCtx | null>(null);
export const useUi = () => { const c = useContext(Ctx); if (!c) throw new Error('UiProvider missing'); return c; };

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [queue, setQueue] = useState<(ConfirmOpts & { resolve: (b: boolean) => void })[]>([]);
  const conf = queue[0] ?? null;
  const [drawer, setDrawer] = useState<TaskDrawerState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const seq = useRef(0);

  const toast = useCallback<UiCtx['toast']>((text, opts) => {
    const id = ++seq.current;
    setToasts(t => [...t.slice(-2), { id, text, ...opts }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts?.action ? 7000 : 4000);
  }, []);
  // Concurrent confirms queue up: every promise settles, one dialog at a time.
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>(resolve => setQueue(q => [...q, { ...o, resolve }])), []);
  const openTask = useCallback<UiCtx['openTask']>((id, defaults) => setDrawer({ id, defaults }), []);
  const closeTask = useCallback(() => setDrawer(null), []);
  const value = useMemo(() => ({ toast, confirm, drawer, openTask, closeTask, sidebarOpen, setSidebarOpen }), [toast, confirm, drawer, openTask, closeTask, sidebarOpen]);

  const done = (b: boolean) => { conf?.resolve(b); setQueue(q => q.slice(1)); };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'toast-error' : ''}`}>
            <span>{t.text}</span>
            {t.action && <button onClick={() => { t.action!.run(); setToasts(x => x.filter(y => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
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

/* ---------- Small pieces ---------- */
export function Empty({ icon = 'inbox', title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={20} /></span>
      <strong>{title}</strong>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string | null; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </label>
  );
}

export function Progress({ value, label, tone = 'brand' }: { value: number; label?: string; tone?: Tone }) {
  const v = Math.round(Math.min(100, Math.max(0, value)));
  return <div className={`progress tone-${tone}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}><span style={{ width: v + '%' }} /></div>;
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: string }[]; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)} title={o.label}>
          {o.icon && <Icon name={o.icon} size={15} />}<span className={o.icon ? 'seg-label' : ''}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
