'use client';

import { useCallback, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, Icon } from '@/components/elements/export';
import { Popover } from './Popover';

/** An action (`onSelect`) or a link (`href`). A link item navigates; it needs no `onSelect`. */
export interface MenuItem { label: string; icon?: string; onSelect?: () => void; href?: string; danger?: boolean; divider?: boolean; disabled?: boolean; checked?: boolean }

const isItem = (x: MenuItem | false | null): x is MenuItem => !!x;

export function Menu({ label, trigger, items, align = 'end', className, header }: {
  label: string; trigger: ReactNode; items: (MenuItem | false | null)[]; align?: 'start' | 'end';
  /** Extra classes for the round trigger button. */
  className?: string;
  /** A line of text above the items. It is not a menu item and cannot be chosen. */
  header?: string;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const list = items.filter(isItem);
  const onKey = (e: KeyboardEvent) => {
    const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])'));
    const i = els.findIndex(el => el === document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault(); els[(i + 1) % els.length]?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus();
    }
    if (e.key === 'Home') {
      e.preventDefault(); els[0]?.focus();
    }
    if (e.key === 'End') {
      e.preventDefault(); els[els.length - 1]?.focus();
    }
  };

  return (
    <>
      {/* onPress stops the press from reaching a card or row the menu sits in, as the old stopPropagation did. */}
      <Button ref={btn} iconOnly className={className} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onPress={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault(); setOpen(true);
          }
        }}>
        {trigger}
      </Button>
      {open && (
        <Popover anchor={btn.current} onClose={close} align={align} label={label} className="menu">
          <div role="menu" aria-label={label} onKeyDown={onKey} onClick={e => e.stopPropagation()}>
            {header && <p className="menu-head" role="presentation">{header}</p>}
            {list.map((it, i) => {
              if (it.divider) {
                return <hr key={i} />;
              }
              const content = (
                <>
                  {it.icon ? <Icon name={it.icon} size={15} /> : <span style={{ width: 15 }} />}
                  <span>{it.label}</span>
                  {it.checked && <Icon name="check" size={14} className="menu-check" />}
                </>
              );
              if (it.href) {
                return (
                  <Link key={i} role="menuitem" href={it.href} className={it.danger ? 'danger' : ''} onClick={() => {
                    close(); it.onSelect?.();
                  }}>
                    {content}
                  </Link>
                );
              }

              return (
                <button key={i} role="menuitem" type="button" disabled={it.disabled} className={it.danger ? 'danger' : ''}
                  onClick={() => {
                    close(); btn.current?.focus(); it.onSelect?.();
                  }}>
                  {content}
                </button>
              );
            })}
          </div>
        </Popover>
      )}
    </>
  );
}
