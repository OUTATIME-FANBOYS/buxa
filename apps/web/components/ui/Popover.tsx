'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
