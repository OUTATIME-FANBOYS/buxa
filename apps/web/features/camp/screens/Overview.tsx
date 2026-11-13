'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/features/kanban/components/Icon';
import { ROUTES } from '@/config/routes';
import { useLoad } from '../hooks/useLoad';
import { ROLE_LABEL, abilitiesFor, roleAllows } from '../lib/abilities';
import { useCamp } from '../state/CampProvider';
import { useCurrentCamp } from '../state/CurrentCamp';
import { RenameDialog } from './RenameDialog';
import { Loading, Problem } from './Status';

type Dialog = null | 'rename';
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export function Overview() {
  const { api } = useCamp();
  const camp = useCurrentCamp();
  const org = useLoad(() => api.org(camp.orgId), [api, camp.orgId]);
  const [dialog, setDialog] = useState<Dialog>(null);

  if (org.status === 'loading') return <Loading what="your camp" />;
  if (org.status === 'error') return <Problem error={org.error} retry={org.retry} />;
  const { data } = org;

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title"><h1>{data.name}</h1><p className="muted">/{data.slug}</p></div>
        <div className="page-actions">{roleAllows(camp.role, 'org:update') && <button className="btn" onClick={() => setDialog('rename')}>Rename</button>}</div>
      </header>

      <section className="grid-3" aria-label="At a glance">
        <Stat label="Members" value={String(data.memberCount)} />
        <Stat label="Your role" value={ROLE_LABEL[camp.role]} />
        <Stat label="Created" value={formatDate(data.createdAt)} />
      </section>

      <div className="grid-2">
        <section className="panel" aria-labelledby="abilities-title">
          <div className="panel-head"><h2 id="abilities-title">What you can do here</h2></div>
          <ul className="abilities">
            {abilitiesFor(camp.role).map(({ label, allowed }) => (
              <li key={label} className={allowed ? 'yes' : 'no'}>
                <Icon name={allowed ? 'check' : 'x'} size={15} /><span>{label}</span>
                <span className="sr-only">{allowed ? ' (allowed)' : ' (not allowed for your role)'}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel" aria-labelledby="board-title">
          <div className="panel-head"><h2 id="board-title">Staff tasks</h2></div>
          <p className="muted">The task board your team uses behind the scenes. It is a demo for now and keeps its data in this browser, separate from the camp.</p>
          <Link className="btn" href={ROUTES.kanban}><Icon name="kanban" size={16} /> Open the staff board</Link>
        </section>
      </div>

      {dialog === 'rename' && <RenameDialog orgId={camp.orgId} currentName={data.name} onClose={() => setDialog(null)} onRenamed={org.retry} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><div className="stat-top"><span className="stat-label">{label}</span></div><span className="stat-num">{value}</span></div>;
}
