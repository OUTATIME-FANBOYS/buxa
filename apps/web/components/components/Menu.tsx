'use client';

import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, Icon } from '@/components/elements/export';
import { Popover } from './Popover';

/**
 * An action (`onSelect`) or a link (`href`). A link item navigates; it needs no `onSelect`. An item with `submenu` opens a group
 * of choices under it (Appearance, Timezone); each choice is a radio-style item, `checked` on the current one, and choosing one
 * closes the whole menu.
 */
export interface MenuItem {
  label: string;
  icon?: string;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
  checked?: boolean;
  submenu?: MenuItem[];
}

const isItem = (x: MenuItem | false | null): x is MenuItem => !!x;

/** A menu item that opens a group of choices beneath it. */
function SubMenu({ item, onChosen }: { item: MenuItem & { submenu: MenuItem[] }; onChosen: () => void }) {
  const [open, setOpen] = useState(false);
  const panel = useId();

  return (
    <>
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panel}
        className="menu-sub-trigger"
        onClick={() => setOpen(o => !o)}
      >
        {item.icon ? <Icon name={item.icon} size={15} /> : <span style={{ width: 15 }} />}
        <span>{item.label}</span>
        <Icon name="right" size={14} className={`menu-chev${open ? ' is-open' : ''}`} />
      </button>
      {open && (
        <div id={panel} role="group" aria-label={item.label} className="menu-sub">
          {item.submenu.map((choice, j) => (
            <button
              key={j}
              type="button"
              role="menuitemradio"
              aria-checked={!!choice.checked}
              className="menu-sub-item"
              onClick={() => {
                onChosen();
                choice.onSelect?.();
              }}
            >
              <span>{choice.label}</span>
              {choice.checked && <Icon name="check" size={14} className="menu-check" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function Menu({
  label,
  trigger,
  items,
  align = 'end',
  className,
  header,
}: {
  label: string;
  trigger: ReactNode;
  items: (MenuItem | false | null)[];
  align?: 'start' | 'end';
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
    const els = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled]), [role=menuitemradio]:not([disabled])'),
    );
    const i = els.findIndex(el => el === document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    }
    if (e.key === 'Home') {
      e.preventDefault();
      els[0]?.focus();
    }
    if (e.key === 'End') {
      e.preventDefault();
      els[els.length - 1]?.focus();
    }
  };

  return (
    <>
      {/* onPress stops the press from reaching a card or row the menu sits in, as the old stopPropagation did. */}
      <Button
        ref={btn}
        iconOnly
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onPress={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </Button>
      {open && (
        <Popover anchor={btn.current} onClose={close} align={align} label={label} className="menu">
          <div role="menu" aria-label={label} onKeyDown={onKey} onClick={e => e.stopPropagation()}>
            {header && (
              <p className="menu-head" role="presentation">
                {header}
              </p>
            )}
            {list.map((it, i) => {
              if (it.divider) {
                return <hr key={i} />;
              }
              if (it.submenu) {
                return (
                  <SubMenu
                    key={i}
                    item={{ ...it, submenu: it.submenu }}
                    onChosen={() => {
                      close();
                      btn.current?.focus();
                    }}
                  />
                );
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
                  <Link
                    key={i}
                    role="menuitem"
                    href={it.href}
                    className={it.danger ? 'danger' : ''}
                    onClick={() => {
                      close();
                      it.onSelect?.();
                    }}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={i}
                  role="menuitem"
                  type="button"
                  disabled={it.disabled}
                  className={it.danger ? 'danger' : ''}
                  onClick={() => {
                    close();
                    btn.current?.focus();
                    it.onSelect?.();
                  }}
                >
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
