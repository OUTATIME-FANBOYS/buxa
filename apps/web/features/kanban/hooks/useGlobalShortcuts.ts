import { useEffect, type RefObject } from 'react';
import { useTaskDrawer } from '../state/TaskDrawerContext';

/** ⌘K or "/" focuses search; "c" starts a new task (when a project exists and no dialog is open). Ignored while typing. */
export function useGlobalShortcuts(searchRef: RefObject<HTMLInputElement | null>, hasProject: boolean) {
  const { openTask } = useTaskDrawer();
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; const typing = /INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable;
      const bare = !typing && !e.metaKey && !e.ctrlKey && !e.altKey;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      else if (bare && e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (bare && e.key.toLowerCase() === 'c' && hasProject && !document.querySelector('[role=dialog]')) { e.preventDefault(); openTask('new'); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [searchRef, hasProject, openTask]);
}
