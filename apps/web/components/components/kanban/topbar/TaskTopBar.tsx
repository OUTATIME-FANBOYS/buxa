'use client';

import type { ReactNode } from 'react';
import { useStore } from '@buxa/middleware/providers/providers';
import type { NotificationItem } from '@buxa/shared';
import { HeaderTools } from '@/components/components/camp';
import { useWorkspaceBellRows } from './Notifications';

/** The save state in words, or null when everything is saved: the header says nothing then. */
function useSaveLabel(): string | null {
  const { saveStatus, sync } = useStore();
  if (sync === 'offline') {
    return 'Offline, retrying';
  }
  if (saveStatus === 'error') {
    return 'Not saved, storage full';
  }
  if (saveStatus === 'saving') {
    return sync === 'synced' ? 'Syncing…' : 'Saving…';
  }

  return null;
}

/**
 * The workspace's top bar, left to right: a note only while something is unsaved or syncing, then the shared header tools (Help and
 * the notifications bell), then the account. `items` and `unread` are the person's notifications from the server.
 */
export function TaskTopBar({
  account,
  items,
  unread,
}: {
  account: ReactNode;
  items: readonly NotificationItem[];
  unread: number;
}) {
  const { saveStatus, sync } = useStore();
  const label = useSaveLabel();
  const { attention, recent, markAllLocal } = useWorkspaceBellRows();

  return (
    <>
      {label && (
        <span className={`save-state save-${sync === 'offline' ? 'error' : saveStatus}`} role="status">
          {label}
        </span>
      )}
      <HeaderTools items={items} unread={unread} attention={attention} recent={recent} onMarkAllLocal={markAllLocal} />
      {account}
    </>
  );
}
