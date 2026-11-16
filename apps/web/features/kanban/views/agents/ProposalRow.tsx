import { Icon, Pill, useUi } from '@/components/ui';
import { useStore } from '../../state/store';
import { useTaskDrawer } from '../../state/TaskDrawerContext';
import * as A from '../../lib/agents';
import type { Proposal } from '../../types';
import { KIND_ICON, STATUS_LABEL, STATUS_TONE } from './labels';

export function ProposalRow({ p, actions: showActions }: { p: Proposal; actions: boolean }) {
  const { s, actions } = useStore(); const { toast } = useUi(); const { openTask } = useTaskDrawer();
  const d = A.describe(s, p.change, p.undo); const kind = A.policyKind(s, p.change); const t = p.taskId ? s.tasks.find(x => x.id === p.taskId) : 'taskId' in p.change ? s.tasks.find(x => x.id === (p.change as { taskId: string }).taskId) : undefined;
  const deciderUser = p.decidedBy ? s.users.find(u => u.id === p.decidedBy) : undefined; const decider = deciderUser ? `${deciderUser.name.split(' ')[0]}${deciderUser.agent ? ' (agent)' : ''}` : undefined;
  return (
    <li className={`prop prop-${p.status}`}>
      <span className="prop-icon" aria-hidden="true"><Icon name={KIND_ICON[kind]} size={15} /></span>
      <div className="prop-main">
        <span className="prop-text">{t ? <>{d.before}<button className="link-inline" onClick={() => openTask(t.id)}>“{d.title}”</button>{d.after}</> : d.text}</span>
        <span className="muted small block">{p.reason}</span>
        {d.diff && <span className="diff small">{d.diff.from && <><span className="diff-from">{d.diff.from}</span><Icon name="arrowRight" size={12} /></>}<span className="diff-to">{d.diff.to}</span></span>}
        {p.note && <span className="small text-crit block">{p.note}</span>}
      </div>
      {p.status === 'pending' && showActions
        ? <div className="row prop-actions">
            <button className="btn btn-sm" onClick={() => actions.decide(p.id, 'reject')} aria-label={`Reject: ${d.text}`}>Reject</button>
            <button className="btn btn-sm btn-primary" onClick={() => { actions.decide(p.id, 'approve'); toast('Approved'); }} aria-label={`Approve: ${d.text}`}>Approve</button></div>
        : <span className="outcome"><Pill tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}{decider && p.status !== 'applied' ? ` by ${decider}` : ''}</Pill></span>}
    </li>
  );
}

