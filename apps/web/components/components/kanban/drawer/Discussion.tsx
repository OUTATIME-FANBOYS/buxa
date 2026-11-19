'use client';

import { useState } from 'react';
import type { Task } from '@buxa/shared';
import { Avatar } from '@/components/elements';
import { Icon } from '@/components/elements';
import { Button } from '@/components/atoms';
import { ago, fmt } from '@buxa/shared';
import { CommentComposer } from './CommentComposer';

type Named = { name: string } | undefined;
interface DiscussionProps {
  task: Task;
  ro: boolean;
  members: { id: string; name: string }[];
  userById: (id?: string) => Named;
}

const mentions = (b: string) =>
  b.split(/(@[\p{L}]+)/gu).map((p, i) =>
    p.startsWith('@') ? (
      <mark
        key={i}
        className="mention buxa:bg-[var(--accent-soft)] buxa:text-[var(--accent-deep)] buxa:rounded-[4px] buxa:[padding:0_3px] buxa:font-semibold"
      >
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );

// A tab: a text button with a 2px underline. The chosen tab's text and underline take the accent (forced: .button is unlayered CSS).
const TAB =
  'buxa:[padding:var(--s2)_0]! buxa:font-semibold buxa:mb-[-1px] buxa:[border-bottom-width:2px]! buxa:[border-bottom-style:solid]!';
const TAB_OFF = 'buxa:text-[var(--text-2)]! buxa:[border-bottom-color:transparent]!';
const TAB_ON = 'buxa:text-[var(--text)]! buxa:border-[var(--accent)]!';

/** Comments and activity, as two tabs. */
export function Discussion({ task, ro, members, userById }: DiscussionProps) {
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');

  return (
    <section className="section buxa:grid buxa:gap-[var(--s3)]">
      <div className="tabs buxa:flex buxa:gap-[var(--s4)] buxa:border-b buxa:border-[var(--line)]" role="tablist">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          role="tab"
          aria-selected={tab === 'comments'}
          className={`${TAB} ${tab === 'comments' ? `on ${TAB_ON}` : TAB_OFF}`}
          onClick={() => setTab('comments')}
        >
          Comments <span className="count">{task.comments.length}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          role="tab"
          aria-selected={tab === 'activity'}
          className={`${TAB} ${tab === 'activity' ? `on ${TAB_ON}` : TAB_OFF}`}
          onClick={() => setTab('activity')}
        >
          Activity <span className="count">{task.history.length}</span>
        </Button>
      </div>
      {tab === 'comments' ? (
        <div role="tabpanel">
          <ul className="thread buxa:grid buxa:gap-[var(--s4)] buxa:[padding:var(--s4)_0]!">
            {task.comments.length === 0 && (
              <li className="muted small buxa:flex buxa:gap-[var(--s3)]">
                No comments yet. Start the conversation, or @mention a teammate.
              </li>
            )}
            {task.comments.map(c => (
              <li key={c.id} className="buxa:flex buxa:gap-[var(--s3)]">
                <Avatar user={userById(c.authorId)} size={28} />
                <div>
                  <div>
                    <strong>{userById(c.authorId)?.name ?? 'Someone'}</strong>{' '}
                    <span className="muted small">{ago(c.at)}</span>
                  </div>
                  <p className="buxa:whitespace-pre-wrap buxa:[overflow-wrap:anywhere]">{mentions(c.body)}</p>
                </div>
              </li>
            ))}
          </ul>
          {!ro && <CommentComposer taskId={task.id} members={members} />}
        </div>
      ) : (
        <ul className="history buxa:grid buxa:gap-[var(--s3)] buxa:[padding:var(--s4)_0]!" role="tabpanel">
          {task.history.map(h => (
            <li key={h.id} className="buxa:flex buxa:gap-[var(--s3)]">
              <span className="dot buxa:w-[7px] buxa:h-[7px] buxa:rounded-full buxa:bg-[var(--line-strong)] buxa:mt-[8px] buxa:flex-none" />
              <span>
                <strong>{userById(h.actorId)?.name ?? 'System'}</strong> {h.text}
                {h.via && (
                  <span className="via">
                    <Icon name="agent" size={12} />
                    {h.via.reason}
                  </span>
                )}
                <span className="muted small block">
                  {ago(h.at)}
                  {h.at ? ` · ${fmt(h.at.slice(0, 10))}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
