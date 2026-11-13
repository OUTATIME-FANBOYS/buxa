import { useState } from 'react';
import type { Task } from '../../types';
import { Avatar, Icon } from '@/components/ui';
import { ago, fmt } from '../../lib/dates';
import { CommentComposer } from './CommentComposer';

type Named = { name: string } | undefined;
interface DiscussionProps { task: Task; ro: boolean; members: { id: string; name: string }[]; userById: (id?: string) => Named }

const mentions = (b: string) => b.split(/(@[\p{L}]+)/gu).map((p, i) => (p.startsWith('@') ? <mark key={i} className="mention">{p}</mark> : <span key={i}>{p}</span>));

/** Comments and activity, as two tabs. */
export function Discussion({ task, ro, members, userById }: DiscussionProps) {
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  return (
    <section className="section">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'comments'} className={tab === 'comments' ? 'on' : ''} onClick={() => setTab('comments')}>Comments <span className="count">{task.comments.length}</span></button>
        <button role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>Activity <span className="count">{task.history.length}</span></button>
      </div>
      {tab === 'comments' ? (
        <div role="tabpanel">
          <ul className="thread">
            {task.comments.length === 0 && <li className="muted small">No comments yet. Start the conversation, or @mention a teammate.</li>}
            {task.comments.map(c => (
              <li key={c.id}><Avatar user={userById(c.authorId)} size={28} />
                <div><div><strong>{userById(c.authorId)?.name ?? 'Someone'}</strong> <span className="muted small">{ago(c.at)}</span></div><p>{mentions(c.body)}</p></div></li>
            ))}
          </ul>
          {!ro && <CommentComposer taskId={task.id} members={members} />}
        </div>
      ) : (
        <ul className="history" role="tabpanel">
          {task.history.map(h => <li key={h.id}><span className="dot" /><span><strong>{userById(h.actorId)?.name ?? 'System'}</strong> {h.text}{h.via && <span className="via"><Icon name="agent" size={12} />{h.via.reason}</span>}<span className="muted small block">{ago(h.at)}{h.at ? ` · ${fmt(h.at.slice(0, 10))}` : ''}</span></span></li>)}
        </ul>
      )}
    </section>
  );
}
