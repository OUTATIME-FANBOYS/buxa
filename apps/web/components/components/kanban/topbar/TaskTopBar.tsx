'use client';

import { useRef, type ReactNode } from 'react';
import { useStore } from '@buxa/middleware/providers/providers';
import { useGlobalShortcuts } from '@buxa/middleware/hooks/hooks';
import { Button } from '@/components/elements';
import { ROUTES } from '@/config/routes';
import { GlobalSearch } from './GlobalSearch';
import { Notifications } from './Notifications';

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
 * The task pieces of the top bar, left to right: search (⌘K or /), a note only while something is unsaved or syncing,
 * Help, notifications, and the account. `account` is the signed-in person's menu.
 */
export function TaskTopBar({ account }: { account: ReactNode }) {
  const { saveStatus, sync, project } = useStore();
  const searchRef = useRef<HTMLInputElement>(null);
  useGlobalShortcuts(searchRef, !!project);
  const label = useSaveLabel();

  return (
    <>
      <GlobalSearch inputRef={searchRef} />
      {label && (
        <span className={`save-state save-${sync === 'offline' ? 'error' : saveStatus}`} role="status">
          {label}
        </span>
      )}
      <Button iconOnly variant="secondary" icon="help" href={ROUTES.help} aria-label="Help" className="header-icon" />
      <Notifications />
      {account}
    </>
  );
}
