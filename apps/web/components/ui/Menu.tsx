'use client';

import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Popover } from './Popover';

export interface MenuItem { label: string; icon?: string; onSelect: () => void; danger?: boolean; divider?: boolean; disabled?: boolean; checked?: boolean }

const isItem = (x: MenuItem | false | null): x is MenuItem => !!x;

export function Menu({ label, trigger, items, align = 'end', className = 'icon-btn' }: {
  label: string; trigger: ReactNode; items: (MenuItem | false | null)[]; align?: 'start' | 'end'; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const list = items.filter(isItem);
  const onKey = (e: KeyboardEvent) => {
    const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])'));
    const i = els.findIndex(el => el === document.activeElement);
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
