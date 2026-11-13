import { useState } from 'react';
import { useStore } from '../../state/store';
import { useUi } from '@/components/ui';

/** A comment box with @mention suggestions drawn from the workspace members. */
export function CommentComposer({ taskId, members }: { taskId: string; members: { id: string; name: string }[] }) {
  const { actions } = useStore(); const { toast } = useUi();
  const [comment, setComment] = useState('');
  const mention = /@([\p{L}]*)$/u.exec(comment);
  const suggestions = mention ? members.filter(m => m.name.split(' ')[0].toLowerCase().startsWith(mention[1].toLowerCase())).slice(0, 4) : [];
  const send = () => {
    const b = comment.trim(); if (!b) return;
    if (b.length > 2000) return toast('Comments are limited to 2,000 characters.', { tone: 'error' });
    actions.addComment(taskId, b); setComment('');
  };
  return (
    <div className="composer">
      <textarea rows={2} value={comment} placeholder="Write a comment…  Use @ to mention" aria-label="Write a comment" onChange={e => setComment(e.target.value)}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); } }} />
      {suggestions.length > 0 && <ul className="mentions" role="listbox">{suggestions.map(m => <li key={m.id}><button type="button" onClick={() => setComment(comment.replace(/@[\p{L}]*$/u, '@' + m.name.split(' ')[0] + ' '))}>{m.name}</button></li>)}</ul>}
      <div className="row-end"><span className="muted small grow">⌘ Enter to send</span><button className="btn btn-primary btn-sm" onClick={send} disabled={!comment.trim()}>Comment</button></div>
    </div>
  );
}
