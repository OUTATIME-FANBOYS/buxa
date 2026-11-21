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
  /** Small icon buttons on the right of the row. Each one acts on its own and never chooses the row. */
  actions?: MenuAction[];
}

/** A round icon button beside a row. `danger` uses the destructive glass style. */
export interface MenuAction {
  label: string;
  icon: string;
  onSelect: () => void;
  danger?: boolean;
}

const isItem = (x: MenuItem | false | null): x is MenuItem => !!x;

// A menu row. Rows are buttons (or links) that carry the shared button styles, so every override they need is forced (!).
const ROW =
  'buxa:box-border buxa:flex! buxa:items-center buxa:justify-start! buxa:text-left! buxa:font-normal! buxa:gap-[var(--s3)] buxa:h-[34px]! buxa:pl-[5px]! buxa:pr-[var(--s3)]! buxa:py-0! buxa:rounded-[var(--r-1)]! buxa:whitespace-nowrap buxa:w-full! buxa:no-underline buxa:text-[inherit]! buxa:hover:bg-[var(--hover)]! buxa:focus-visible:bg-[var(--hover)]! buxa:focus-visible:outline-none! buxa:disabled:opacity-[0.4]! buxa:disabled:cursor-default!';
// A choice in a flyout: a radio-style row, as wide as the flyout and left aligned.
const CHOICE =
  'buxa:box-border buxa:flex! buxa:items-center buxa:font-normal! buxa:gap-[var(--s3)] buxa:h-[32px]! buxa:px-[var(--s3)]! buxa:py-0! buxa:border-0! buxa:rounded-[var(--r-1)]! buxa:bg-transparent! buxa:[font:inherit]! buxa:text-[inherit]! buxa:whitespace-nowrap buxa:w-full! buxa:justify-start! buxa:text-left! buxa:cursor-pointer buxa:hover:bg-[var(--hover)]! buxa:focus-visible:bg-[var(--hover)]! buxa:focus-visible:outline-none!';
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
        {item.icon && <Icon name={item.icon} size={15} />}
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
  search,
  footer = [],
}: {
  label: string;
  trigger: ReactNode;
  items: (MenuItem | false | null)[];
  align?: 'start' | 'end';
  /** Extra classes for the round trigger button. */
  className?: string;
  /** A line of text above the items. It is not a menu item and cannot be chosen. */
  header?: string;
  /**
   * A search field above the items. The caller filters `items` by `value`. With a search, `items` scroll inside a capped
   * height while the search field and `footer` stay put. Its value is cleared when the menu closes.
   */
  search?: { label: string; placeholder: string; value: string; onChange: (value: string) => void };
  /** Rows that stay fixed under the scrolling `items`, such as "New camp…". Only shown beside the scrolling list (`search`). */
  footer?: (MenuItem | false | null)[];
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLElement>(null);
  const shut = () => {
    setOpen(false);
    search?.onChange('');
  };
  const close = useCallback(() => {
    setOpen(false);
    search?.onChange('');
  }, [search]);
  const list = items.filter(isItem);
  const fixed = footer.filter(isItem);
  const onKey = (e: KeyboardEvent) => {
    const els = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        '[role=menuitem]:not([disabled]), [role=menuitemradio]:not([disabled])',
      ),
    );
    const i = els.findIndex(el => el === document.activeElement);
    const inField = e.target instanceof HTMLInputElement;
    if (inField && e.key === 'Enter') {
      // Enter in the search field moves into the list; a second Enter chooses the item, as usual.
      e.preventDefault();
      els[0]?.focus();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[i < 0 ? els.length - 1 : (i - 1 + els.length) % els.length]?.focus();
    }
    if (!inField && e.key === 'Home') {
      e.preventDefault();
      els[0]?.focus();
    }
    if (!inField && e.key === 'End') {
      e.preventDefault();
      els[els.length - 1]?.focus();
    }
  };

  // One row: a divider, a nested group, a link, or a button, with optional icon buttons on its right.
  const renderRow = (it: MenuItem, i: number) => {
    if (it.divider) {
      return <hr key={i} className="buxa:[margin:var(--s1)_0] buxa:border-0 buxa:border-t buxa:border-[var(--line)]" />;
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
        {it.icon && <Icon name={it.icon} size={15} />}
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
    const choose = (
      <Button
        key={it.actions?.length ? undefined : i}
        variant="ghost"
        role="menuitem"
        type="button"
        disabled={it.disabled}
        className={`${it.danger ? 'danger buxa:text-[var(--crit)]!' : ''} ${ROW}${it.actions?.length ? ' buxa:flex-1 buxa:min-w-0' : ''}`}
        onClick={() => {
          close();
          btn.current?.focus();
          it.onSelect?.();
        }}
      >
        {content}
      </Button>
    );
    if (!it.actions?.length) {
      return choose;
    }

    // The row name chooses the item; each icon button acts on the row and leaves the choice alone.
    return (
      <div key={i} className="buxa:flex buxa:items-center buxa:gap-[var(--s1)]">
        {choose}
        {it.actions.map(action => (
          <Button
            key={action.label}
            type="button"
            size="sm"
            iconOnly
            variant={action.danger ? 'glass-danger' : 'glass'}
            icon={action.icon}
            aria-label={action.label}
            title={action.label}
            onPress={e => {
              e.stopPropagation();
              close();
              action.onSelect();
            }}
          />
        ))}
      </div>
    );
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
        onPress={() => (open ? shut() : setOpen(true))}
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
            {search && (
              <div className="buxa:px-[var(--s1)] buxa:pt-[var(--s1)] buxa:pb-[var(--s2)]">
                <input
                  type="search"
                  aria-label={search.label}
                  placeholder={search.placeholder}
                  value={search.value}
                  autoFocus
                  autoComplete="off"
                  onChange={e => search.onChange(e.target.value)}
                  className="buxa:box-border buxa:w-full buxa:h-[28px] buxa:px-[var(--s3)] buxa:rounded-[var(--r-1)] buxa:border buxa:border-[var(--line)] buxa:bg-transparent buxa:text-[var(--text)] buxa:[font:inherit] buxa:placeholder:text-[var(--muted)] buxa:focus-visible:outline-none buxa:focus-visible:border-[var(--accent)]"
                />
              </div>
            )}
            {header && (
              <p
                className="menu-head buxa:py-[var(--s2)] buxa:px-[var(--s3)] buxa:font-semibold buxa:text-[var(--text)] buxa:whitespace-nowrap buxa:overflow-hidden buxa:text-ellipsis buxa:max-w-[240px]"
                role="presentation"
              >
                {header}
              </p>
            )}
            {search ? (
              <div className="buxa:grid buxa:max-h-[min(50vh,360px)] buxa:overflow-y-auto">{list.map(renderRow)}</div>
            ) : (
              list.map(renderRow)
            )}
            {fixed.map((it, i) => renderRow(it, list.length + i))}
          </div>
        </Popover>
      )}
    </>
  );
}
