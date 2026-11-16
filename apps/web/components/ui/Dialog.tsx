'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { project, reduceMotion, rubberband, springAnimate, VelocityTracker } from '@/lib/motion';
import { FOCUSABLE } from './focus';
import { Icon } from './Icon';

const CloseCtx = createContext<() => void>(() => {});
/** The close function of the nearest Dialog, so a child can dismiss it with the exit animation. */
export const useDialogClose = () => useContext(CloseCtx);

interface Swipe { id: number; x0: number; x: number; on: boolean; vel: VelocityTracker; cancel?: () => void }

export function Dialog({ title, onClose, children, footer, drawer = false, wide = false, labelledBy }: {
  title?: string; onClose: () => void; children: ReactNode | ((close: () => void) => ReactNode); footer?: ReactNode; drawer?: boolean; wide?: boolean; labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null); const scrim = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const exitTimer = useRef<number | undefined>(undefined);
  const swipe = useRef<Swipe | null>(null);

  // Leave the way we came: the exit mirrors the entrance.
  const close = useCallback(() => {
    if (leaving) return;
    if (reduceMotion()) { onClose(); return; }
    setLeaving(true); exitTimer.current = window.setTimeout(onClose, 190);
  }, [leaving, onClose]);
  // If the parent unmounts us first (e.g. after delete), nothing may fire afterwards.
  useEffect(() => () => { window.clearTimeout(exitTimer.current); swipe.current?.cancel?.(); }, []);

  useEffect(() => {
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; prev?.focus?.(); };
  }, []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab' && ref.current) {
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(x => x.offsetParent !== null);
      const first = f[0]; const last = f[f.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  // Drawer: grab the header and drag. 1:1 tracking, rubber-band on the far side, momentum-projected dismiss.
  const onPD = (e: PointerEvent<HTMLDivElement>) => {
    if (!drawer || !(e.target instanceof Element)) return; const t = e.target;
    if (!t.closest('[data-sheet-handle]') || t.closest('button,a,input,select,textarea,[role=menu]')) return;
    swipe.current?.cancel?.();
    const vel = new VelocityTracker(); vel.push(e.clientX);
    swipe.current = { id: e.pointerId, x0: e.clientX, x: 0, on: false, vel };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPM = (e: PointerEvent<HTMLDivElement>) => {
    const w = swipe.current; if (!w || e.pointerId !== w.id || !ref.current) return;
    const dx = e.clientX - w.x0; if (!w.on && Math.abs(dx) < 8) return; w.on = true;
    const width = ref.current.offsetWidth; w.x = dx >= 0 ? dx : -rubberband(-dx, width);
    ref.current.style.translate = `${w.x}px 0`; if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - w.x / width));
    w.vel.push(e.clientX);
  };
  const onPU = (e: PointerEvent<HTMLDivElement>) => {
    const w = swipe.current; if (!w || e.pointerId !== w.id || !ref.current) return;
    if (!w.on) { swipe.current = null; return; }
    const el = ref.current; const width = el.offsetWidth; const v = w.vel.get()[0];
    const dismiss = w.x > 0 && (w.x + project(v) > width * 0.5 || v > 700);
    const apply = (x: number) => { el.style.translate = `${x}px 0`; if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - x / width)); };
    w.cancel = springAnimate({ from: [w.x], to: [dismiss ? width : 0], velocity: [v], damping: dismiss ? 1 : Math.abs(v) > 500 ? 0.8 : 1, response: 0.34,
      onFrame: p => apply(p[0] ?? 0), onDone: () => { swipe.current = null; if (dismiss) onClose(); else { el.style.translate = ''; if (scrim.current) scrim.current.style.opacity = ''; } } });
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
