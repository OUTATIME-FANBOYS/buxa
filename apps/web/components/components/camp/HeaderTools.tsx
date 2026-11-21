'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Icon } from '@/components/elements';
import { Empty, Popover } from '@/components/components';
import { markNotificationsRead } from '@/actions/notifications';
import { ROUTES } from '@/config/routes';
import { ago, NOTIFICATION_ICON, NOTIFICATION_LIMIT, type NotificationItem } from '@buxa/shared';

// The panel is left-aligned throughout: the head, each row's title and time. The row's button styles are forced (.button is unlayered CSS).
const HEAD =
  'buxa:flex buxa:justify-between buxa:items-center buxa:[padding:var(--s3)_var(--s4)] buxa:border-b buxa:border-[var(--line)] buxa:sticky buxa:top-0 buxa:bg-[var(--surface)] buxa:text-left';
const ITEM =
  'buxa:flex! buxa:gap-[var(--s3)] buxa:items-start buxa:w-full! buxa:justify-start! buxa:text-left! buxa:[padding:var(--s3)_var(--s4)]! buxa:hover:bg-[var(--hover)]!';
const UNREAD = 'buxa:bg-[color-mix(in_srgb,var(--f-crit)_12%,var(--surface))]!';
const DOT =
  'buxa:w-[26px] buxa:h-[26px] buxa:rounded-full buxa:grid buxa:place-items-center buxa:flex-none buxa:bg-[var(--surface-3)] buxa:text-[var(--text-2)]';

/** One row in the bell's list. The workspace builds its own rows from the board; the server rows come in as data. */
export interface BellRow {
  key: string;
  text: string;
  icon: string;
  /** When it happened (ISO), or null for a reminder with no time. */
  at: string | null;
  unread: boolean;
  onOpen: () => void;
}

/**
 * The header tools on every page: Help (a glass icon link) and the notifications bell. The same component sits in the camp header
 * and the workspace top bar, so every page shows them the same way. `items` are the signed-in person's notifications from the server
 * (newest first, capped); `attention` and `recent` are the workspace's own rows (task reminders and board notices).
 */
export function HeaderTools({
  items,
  unread,
  attention = [],
  recent = [],
  onMarkAllLocal,
}: {
  items: readonly NotificationItem[];
  unread: number;
  attention?: readonly BellRow[];
  recent?: readonly BellRow[];
  /** Marks the workspace's own rows read (the board's notices). The server rows are marked by the bell itself. */
  onMarkAllLocal?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  async function openItem(item: NotificationItem) {
    await markNotificationsRead([item.id]);
    setOpen(false);
    router.push(item.link);
  }
  const pick = (row: BellRow) => {
    setOpen(false);
    row.onOpen();
  };

  async function markAll() {
    onMarkAllLocal?.();
    await markNotificationsRead(null);
    router.refresh();
  }

  const fromServer: BellRow[] = items.map(item => ({
    key: item.id,
    text: item.title,
    icon: NOTIFICATION_ICON[item.kind],
    at: item.createdAt,
    unread: item.readAt === null,
    onOpen: () => {
      void openItem(item);
    },
  }));
  const recentRows = [...recent, ...fromServer]
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
    .slice(0, NOTIFICATION_LIMIT);
  const count = unread + attention.length + recent.filter(row => row.unread).length;
  const anyUnread = count > 0;
  const nothing = attention.length === 0 && recentRows.length === 0;

  return (
    <>
      <Button iconOnly variant="glass" size="sm" icon="help" href={ROUTES.help} aria-label="Help" title="Help" />
      <Button
        iconOnly
        variant="glass"
        size="sm"
        icon="bell"
        ref={btn}
        className="bell"
        aria-label={`Notifications${anyUnread ? `, ${count > 9 ? '9+' : count} need attention` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {anyUnread && <span className="badge">{count > 9 ? '9+' : count}</span>}
      </Button>
      {open && (
        <Popover
          anchor={btn.current}
          onClose={() => setOpen(false)}
          align="end"
          width={360}
          label="Notifications"
          className="notif buxa:p-0!"
        >
          <div className={`notif-head ${HEAD}`}>
            <strong>Notifications</strong>
            <Button
              variant="ghost"
              size="sm"
              className="link"
              icon="check"
              onClick={() => void markAll()}
              disabled={!recentRows.some(row => row.unread)}
            >
              Mark all read
            </Button>
          </div>
          <div className="notif-list buxa:text-left">
            {attention.length > 0 && <div className="eyebrow pad">Needs attention</div>}
            {attention.map(row => (
              <BellItem key={row.key} row={row} onPick={pick} />
            ))}
            {recentRows.length > 0 && <div className="eyebrow pad">Recent</div>}
            {recentRows.map(row => (
              <BellItem key={row.key} row={row} onPick={pick} />
            ))}
            {nothing && (
              <Empty
                icon="bell"
                title="You’re all caught up"
                body="Assignments, mentions, deadlines and camp changes will show up here."
              />
            )}
          </div>
        </Popover>
      )}
    </>
  );
}

function BellItem({ row, onPick }: { row: BellRow; onPick: (row: BellRow) => void }) {
  return (
    <Button
      variant="ghost"
      className={`notif-item ${ITEM} ${row.unread ? `unread ${UNREAD}` : ''}`}
      onClick={() => onPick(row)}
    >
      <span className={`notif-dot ${DOT}`}>
        <Icon name={row.icon} size={14} />
      </span>
      <span className="notif-text">
        <span>{row.text}</span>
        {row.at && <span className="muted small block">{ago(row.at)}</span>}
      </span>
    </Button>
  );
}
