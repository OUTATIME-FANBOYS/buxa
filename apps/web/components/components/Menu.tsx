'use client';

import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, Icon } from '@/components/elements';
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

// A menu row. Rows are buttons (or links) that carry the shared button styles, so every override they need is forced (!).
const ROW =
  'buxa:box-border buxa:flex! buxa:items-center buxa:gap-[var(--s3)] buxa:h-[34px]! buxa:px-[var(--s3)]! buxa:py-0! buxa:rounded-[var(--r-1)]! buxa:whitespace-nowrap buxa:w-full! buxa:no-underline buxa:text-[inherit]! buxa:hover:bg-[var(--hover)]! buxa:focus-visible:bg-[var(--hover)]! buxa:focus-visible:outline-none! buxa:disabled:opacity-[0.4]! buxa:disabled:cursor-default!';
// A choice in a flyout: a radio-style row, as wide as the flyout and left aligned.
const CHOICE =
  'buxa:box-border buxa:flex! buxa:items-center buxa:gap-[var(--s3)] buxa:h-[32px]! buxa:px-[var(--s3)]! buxa:py-0! buxa:border-0! buxa:rounded-[var(--r-1)]! buxa:bg-transparent! buxa:[font:inherit]! buxa:text-[inherit]! buxa:whitespace-nowrap buxa:w-full! buxa:justify-start! buxa:text-left! buxa:cursor-pointer buxa:hover:bg-[var(--hover)]! buxa:focus-visible:bg-[var(--hover)]! buxa:focus-visible:outline-none!';
const CHECK = 'buxa:ml-auto buxa:text-[var(--accent)]';

/** A menu item that opens a group of choices beneath it. */
/**
 * A menu item that opens its choices in a flyout beside it. The flyout opens on hover (and on click, for touch and keyboard), and
 * stays open while the pointer is on either the item or the flyout.
 */
function SubMenu({ item, onChosen }: { item: MenuItem & { submenu: MenuItem[] }; onChosen: () => void }) {
  const [open, setOpen] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panel = useId();
  const stay = () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
  };
  const later = () => {
    stay();
    timer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div ref={row} className="menu-sub-row" onMouseEnter={() => (stay(), setOpen(true))} onMouseLeave={later}>
      <Button
        variant="ghost"
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panel}
        className={`menu-sub-trigger ${ROW}`}
        onClick={() => setOpen(o => !o)}
      >
        {item.icon ? <Icon name={item.icon} size={15} /> : <span style={{ width: 15 }} />}
        <span>{item.label}</span>
        <Icon
          name="right"
          size={14}
          className={`menu-chev buxa:ml-auto buxa:text-[var(--muted)] ${open ? 'is-open' : ''}`}
        />
      </Button>
      {open && row.current && (
        <Popover
          anchor={row.current}
          onClose={() => setOpen(false)}
          side="beside"
          label={item.label}
          className="menu menu-flyout buxa:w-max buxa:min-w-0!"
        >
          <div
            id={panel}
            role="group"
            aria-label={item.label}
            data-menu-flyout
            className="menu-sub buxa:grid buxa:pl-0 buxa:justify-items-stretch buxa:text-left"
            onMouseEnter={stay}
            onMouseLeave={later}
          >
            {item.submenu.map((choice, j) => (
              <Button
                key={j}
                variant="ghost"
                type="button"
                role="menuitemradio"
                aria-checked={!!choice.checked}
                className={`menu-sub-item ${CHOICE}`}
                onClick={() => {
                  onChosen();
                  choice.onSelect?.();
                }}
              >
                <span className="buxa:flex-[1_1_auto] buxa:text-left">{choice.label}</span>
                {choice.checked && <Icon name="check" size={14} className={`menu-check ${CHECK}`} />}
              </Button>
            ))}
          </div>
        </Popover>
      )}
    </div>
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
      e.currentTarget.querySelectorAll<HTMLElement>(
        '[role=menuitem]:not([disabled]), [role=menuitemradio]:not([disabled])',
      ),
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
          <div
            className="buxa:grid"
            role="menu"
            aria-label={label}
            onKeyDown={onKey}
            onClick={e => e.stopPropagation()}
          >
            {header && (
              <p
                className="menu-head buxa:py-[var(--s2)] buxa:px-[var(--s3)] buxa:font-semibold buxa:text-[var(--text)] buxa:whitespace-nowrap buxa:overflow-hidden buxa:text-ellipsis buxa:max-w-[240px]"
                role="presentation"
              >
                {header}
              </p>
            )}
            {list.map((it, i) => {
              if (it.divider) {
                return (
                  <hr
                    key={i}
                    className="buxa:[margin:var(--s1)_0] buxa:border-0 buxa:border-t buxa:border-[var(--line)]"
                  />
                );
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
                  {it.checked && <Icon name="check" size={14} className={`menu-check ${CHECK}`} />}
                </>
              );
              if (it.href) {
                return (
                  <Link
                    key={i}
                    role="menuitem"
                    href={it.href}
                    className={`${it.danger ? 'danger' : ''} ${ROW}`}
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
                <Button
                  key={i}
                  variant="ghost"
                  role="menuitem"
                  type="button"
                  disabled={it.disabled}
                  className={`${it.danger ? 'danger buxa:text-[var(--crit)]!' : ''} ${ROW}`}
                  onClick={() => {
                    close();
                    btn.current?.focus();
                    it.onSelect?.();
                  }}
                >
                  {content}
                </Button>
              );
            })}
          </div>
        </Popover>
      )}
    </>
  );
}
