'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// The glass panel: blurred material, a hairline edge, a soft shadow. Its pop-in uses the pop keyframes in the Tailwind theme.
const POPOVER =
  'buxa:fixed buxa:z-[60] buxa:bg-[var(--material)] buxa:[-webkit-backdrop-filter:blur(24px)_saturate(170%)] buxa:[backdrop-filter:blur(24px)_saturate(170%)] buxa:border buxa:border-[color-mix(in_srgb,var(--line)_80%,transparent)] buxa:rounded-[var(--r-2)] buxa:shadow-[var(--shadow)] buxa:p-[var(--s1)] buxa:min-w-[180px] buxa:max-h-[min(70vh,480px)] buxa:overflow-auto buxa:[animation:pop_0.18s_var(--ease-out)]';

export function Popover({
  anchor,
  onClose,
  align = 'start',
  width,
  children,
  label,
  className = '',
  side = 'below',
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  align?: 'start' | 'end';
  width?: number;
  children: ReactNode;
  label?: string;
  className?: string;
  /** `below` drops under the anchor; `beside` opens to its right, or its left when there is no room (a submenu flyout). */
  side?: 'below' | 'beside';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) {
      return;
    }
    const r = anchor.getBoundingClientRect();
    const h = ref.current.offsetHeight;
    const w = ref.current.offsetWidth;
    let top = r.bottom + 6;
    if (top + h > innerHeight - 8) {
      top = Math.max(8, r.top - h - 6);
    }
    let left = align === 'end' ? r.right - w : r.left;
    if (side === 'beside') {
      top = Math.max(8, Math.min(r.top, innerHeight - h - 8));
      left = r.right + 6;
      if (left + w > innerWidth - 8) {
        left = r.left - w - 6;
      }
    }
    left = Math.min(Math.max(8, left), innerWidth - w - 8);
    const above = side === 'below' && top < r.top;
    setPos({ top, left, origin: `${Math.round(r.left + r.width / 2 - left)}px ${above ? h : 0}px` });
  }, [anchor, align, side, children]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      const inFlyout = t instanceof Element && t.closest('[data-menu-flyout]') !== null;
      if (!ref.current?.contains(t) && !anchor?.contains(t) && !inFlyout) {
        onClose();
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        anchor?.focus();
      }
    };
    const scroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key, true);
    addEventListener('scroll', scroll, true);
    addEventListener('resize', onClose);

    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key, true);
      removeEventListener('scroll', scroll, true);
      removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus],[role=menuitem],input,button')?.focus();
  }, []);

  return createPortal(
    <div
      ref={ref}
      className={`popover ${POPOVER} ${className}`}
      role="dialog"
      aria-label={label}
      style={{
        top: pos?.top ?? -999,
        left: pos?.left ?? -999,
        width,
        transformOrigin: pos?.origin,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
