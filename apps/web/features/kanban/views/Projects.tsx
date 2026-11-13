import { useState } from 'react';
import { useStore } from '../store';
import { Avatar, Empty, Menu, Pill, Progress, useUi } from '../components/ui';
import { Icon } from '../components/Icon';
import { ProjectDialog } from '../components/dialogs';
import { diffDays, fmt, today } from '../lib/dates';
import { navigate } from '../lib/router';
import { HEALTH_LABEL, HEALTH_TONE, healthOf, progressOf } from '../lib/stats';
import type { Project } from '../types';

export function Projects() {
  const { s, actions, projects, workspace, wsTasks, kindOf, members, readOnly } = useStore(); const { confirm, toast } = useUi();
  const [dlg, setDlg] = useState<{ project?: Project } | null>(null);
  const del = async (p: Project) => {
    if (await confirm({ title: `Delete “${p.name}”?`, body: 'The board and all of its tasks will be removed. This cannot be undone.', confirmLabel: 'Delete project', danger: true })) { actions.deleteProject(p.id); toast('Project deleted'); }
  };
  void s;
  return (
    <div className="page">
      <header className="page-head"><div className="page-title"><h1>Projects</h1><p className="muted">{workspace?.name} · {projects.length} project{projects.length === 1 ? '' : 's'}</p></div>
        {!readOnly && <div className="page-actions"><button className="btn btn-primary" onClick={() => setDlg({})}><Icon name="plus" size={16} />New project</button></div>}</header>
      {projects.length === 0 ? <Empty icon="folder" title="Start your first project" body="Each project gets its own Kanban board." action={!readOnly ? <button className="btn btn-primary" onClick={() => setDlg({})}>New project</button> : undefined} /> : (
        <div className="cards-grid">
          {projects.map(p => {
            const pr = progressOf(wsTasks.filter(x => x.projectId === p.id), kindOf); const { done: d, total, pct: v } = pr; const h = healthOf(pr, p.deadline);
            const left = p.deadline ? diffDays(p.deadline, today()) : null;
            return (
              <article key={p.id} className={`project-card tone-${HEALTH_TONE[h]}`}>
                <div className="pc-top"><h2><a href={'#/board/' + p.id} onClick={() => actions.selectProject(p.id)}>{p.name}</a></h2>
                  {!readOnly && <Menu label={`Actions for ${p.name}`} trigger={<Icon name="more" />} items={[{ label: 'Open board', icon: 'kanban', onSelect: () => navigate('/board/' + p.id) }, { label: 'Edit details', icon: 'edit', onSelect: () => setDlg({ project: p }) }, { label: '', divider: true, onSelect() {} }, { label: 'Delete project', icon: 'trash', danger: true, onSelect: () => del(p) }]} />}</div>
                <div><Pill tone={HEALTH_TONE[h]}>{HEALTH_LABEL[h]}</Pill></div>
                <p className="muted clamp">{p.description || 'No description yet.'}</p>
                <div><div className="pc-row small"><span>{d} of {total} done</span><strong>{Math.round(v)}%</strong></div><Progress value={v} tone={HEALTH_TONE[h]} label={`${p.name} completion`} /></div>
                <div className="pc-foot"><span className="avatars">{members.slice(0, 4).map(m => <Avatar key={m.userId} user={m.user} size={24} />)}</span>
                  {p.deadline && <span className={`small ${left! < 0 ? 'text-crit' : 'muted'}`}>{left! < 0 ? 'Past deadline' : `Due ${fmt(p.deadline)}`}</span>}</div>
              </article>
            );
          })}
        </div>
      )}
      {dlg && <ProjectDialog project={dlg.project} onClose={() => setDlg(null)} />}
    </div>
  );
}
