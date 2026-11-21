'use client';

import { useMemo } from 'react';
import { useStore } from '@buxa/middleware/providers/providers';
import { useTaskDrawer } from '@buxa/middleware/providers/providers';
import type { BellRow } from '@/components/components/camp/HeaderTools';
import { diffDays, today } from '@buxa/shared';

const NOTICE_ICON: Record<string, string> = { mention: 'at', comment: 'message', complete: 'check', invite: 'users' };

/**
 * The workspace's own rows for the bell: task reminders (derived from the board: overdue, due today, due tomorrow, all of mine)
 * as "Needs attention", and the board's notices as "Recent". The server's rows are added by the bell itself.
 */
export function useWorkspaceBellRows(): {
  attention: BellRow[];
  recent: BellRow[];
  markAllLocal: () => void;
} {
  const { s, me, wsTasks, kindOf, actions } = useStore();
  const { openTask } = useTaskDrawer();

  const attention = useMemo<BellRow[]>(
    () =>
      wsTasks
        .flatMap(t => {
          if (t.assigneeId !== me?.id || t.archived || kindOf(t) === 'done' || !t.due) {
            return [];
          }
          const n = diffDays(t.due, today());
          if (n > 1) {
            return [];
          }
          const text =
            n < 0
              ? `“${t.title}” is ${-n} day${n === -1 ? '' : 's'} overdue`
              : n === 0
                ? `“${t.title}” is due today`
                : `“${t.title}” is due tomorrow`;

          return [{ due: t.due, id: t.id, text, icon: 'clock', unread: true, overdue: n < 0 }];
        })
        .sort((a, b) => a.due.localeCompare(b.due))
        .map(row => ({
          key: row.id,
          text: row.text,
          icon: 'clock',
          at: null,
          unread: row.unread,
          onOpen: () => openTask(row.id),
        })),
    [wsTasks, me, kindOf, openTask],
  );

  const mine = s.notices.filter(n => n.userId === me?.id);
  const recent = useMemo<BellRow[]>(
    () =>
      mine.map(n => ({
        key: n.id,
        text: n.text,
        icon: NOTICE_ICON[n.kind] ?? 'tasks',
        at: n.at,
        unread: !n.read,
        onOpen: () => {
          actions.markNoticeRead(n.id);
          if (n.taskId && s.tasks.some(t => t.id === n.taskId)) {
            openTask(n.taskId);
          }
        },
      })),
    [mine, s.tasks, actions, openTask],
  );

  return {
    attention,
    recent,
    markAllLocal: actions.markAllRead,
  };
}
