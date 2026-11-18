'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from '@buxa/middleware/providers/providers';
import { useTaskDrawer } from '@buxa/middleware/providers/providers';
import { Empty } from '@/components/components';
import { Icon, Button } from '@/components/elements';
import { Popover } from '@/components/components';
import { ago, diffDays, today } from '@buxa/shared';

const NOTICE_ICON: Record<string, string> = { mention: 'at', comment: 'message', complete: 'check', invite: 'users' };

export function Notifications() {
  const { s, me, wsTasks, kindOf, actions } = useStore();
  const { openTask } = useTaskDrawer();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const reminders = useMemo(
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

          return [
            {
              id: t.id,
              taskId: t.id,
              due: t.due,
              overdue: n < 0,
              text:
                n < 0
                  ? `“${t.title}” is ${-n} day${n === -1 ? '' : 's'} overdue`
                  : n === 0
                    ? `“${t.title}” is due today`
                    : `“${t.title}” is due tomorrow`,
            },
          ];
        })
        .sort((a, b) => a.due.localeCompare(b.due)),
    [wsTasks, me, kindOf],
  );
  const mine = s.notices.filter(n => n.userId === me?.id);
  const unread = mine.filter(n => !n.read).length + reminders.length;

  return (
    <>
      <Button
        iconOnly
        icon="bell"
        ref={btn}
        className="bell"
        aria-label={`Notifications${unread ? `, ${unread} need attention` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
      </Button>
      {open && (
        <Popover anchor={btn.current} onClose={close} align="end" width={360} label="Notifications" className="notif">
          <div className="notif-head">
            <strong>Notifications</strong>
            <Button
              variant="ghost"
              size="sm"
              className="link"
              icon="check"
              onClick={actions.markAllRead}
              disabled={!mine.some(n => !n.read)}
            >
              Mark all read
            </Button>
          </div>
          <div className="notif-list">
            {reminders.length > 0 && <div className="eyebrow pad">Needs attention</div>}
            {reminders.map(r => (
              <Button
                key={r.id}
                variant="ghost"
                className="notif-item"
                onClick={() => {
                  close();
                  openTask(r.taskId);
                }}
              >
                <span className={`notif-dot ${r.overdue ? 'crit' : 'warn'}`}>
                  <Icon name="clock" size={14} />
                </span>
                <span>{r.text}</span>
              </Button>
            ))}
            {mine.length > 0 && <div className="eyebrow pad">Recent</div>}
            {mine.slice(0, 15).map(n => (
              <Button
                key={n.id}
                variant="ghost"
                className={`notif-item ${n.read ? '' : 'unread'}`}
                onClick={() => {
                  actions.markNoticeRead(n.id);
                  if (n.taskId && s.tasks.some(t => t.id === n.taskId)) {
                    close();
                    openTask(n.taskId);
                  }
                }}
              >
                <span className="notif-dot">
                  <Icon name={NOTICE_ICON[n.kind] ?? 'tasks'} size={14} />
                </span>
                <span>
                  <span>{n.text}</span>
                  <span className="muted small block">{ago(n.at)}</span>
                </span>
              </Button>
            ))}
            {!reminders.length && !mine.length && (
              <Empty
                icon="bell"
                title="You’re all caught up"
                body="Assignments, mentions and deadlines will show up here."
              />
            )}
          </div>
        </Popover>
      )}
    </>
  );
}
