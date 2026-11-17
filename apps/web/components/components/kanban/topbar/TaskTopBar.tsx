'use client';

import { useRef, type ReactNode } from 'react';
import { useStore } from '@buxa/middleware/providers/providers';
import { useGlobalShortcuts } from '@buxa/middleware/hooks/hooks';
import { GlobalSearch } from './GlobalSearch';
import { Notifications } from './Notifications';

function useSaveLabel() {
  const { saveStatus, sync } = useStore();
  if (sync === 'offline') {
    return 'Offline, retrying';
  }
  if (saveStatus === 'error') {
    return 'Not saved, storage full';
  }
  if (sync === 'synced') {
    return saveStatus === 'saving' ? 'Syncing…' : 'Synced';
  }

  return saveStatus === 'saving' ? 'Saving…' : 'Saved';
}

/**
 * The task pieces of the top bar: search (⌘K or /), the save state, notifications, and the account.
 * `account` is the signed-in person's menu.
 */
export function TaskTopBar({ account }: { account: ReactNode }) {
  const { saveStatus, sync, project } = useStore();
  const searchRef = useRef<HTMLInputElement>(null);
  useGlobalShortcuts(searchRef, !!project);
  const label = useSaveLabel();

  return (
    <>
      <GlobalSearch inputRef={searchRef} />
      <span className={`save-state save-${sync === 'offline' ? 'error' : saveStatus}`} role="status">{label}</span>
      <Notifications />
      {account}
    </>
  );
}
