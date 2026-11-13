import { ROUTES } from '@/config/routes';
import { Icon } from '@/components/ui';
import { useStore } from '../../state/store';
import type { Route } from '../../lib/router';
import { NAV } from './nav';

export function Sidebar({ route }: { route: Route }) {
  const { s, actions, workspace, project, projects } = useStore();
  const collapsed = s.ui.sidebarCollapsed;
  const waiting = s.ui.agentsEnabled && workspace ? s.proposals.filter(p => p.status === 'pending' && s.agents.find(a => a.userId === p.agentId)?.workspaceId === workspace.id).length : 0;
  const nav = NAV.filter(n => n.key !== 'agents' || s.ui.agentsEnabled);
  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebar-head">
        <a className="brand" href="#/dashboard"><span className="logo" aria-hidden="true"><Icon name="kanban" size={16} /></span><span className="collapsible">Buxa</span></a>
      </div>
      <nav>
        <ul>
          <li><a href={ROUTES.camp} title={collapsed ? 'Camp home' : undefined}><Icon name="users" size={18} /><span className="collapsible">Camp home</span></a></li>
          {nav.map(n => {
            const active = route.name === n.key;
            const to = n.key === 'board' && project ? '/board/' + project.id : n.to;
            return (
              <li key={n.key}>
                <a href={'#' + to} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} title={collapsed ? n.label : undefined}>
                  <Icon name={n.icon} size={18} /><span className="collapsible">{n.label}</span>
                  {n.key === 'agents' && waiting > 0 && <span className="nav-badge" aria-label={`${waiting} waiting for approval`}>{waiting}</span>}
                </a>
                {n.key === 'board' && !collapsed && projects.length > 0 && (
                  <ul className="subnav">
                    {projects.map(p => (
                      <li key={p.id}><a href={'#/board/' + p.id} className={route.name === 'board' && project?.id === p.id ? 'active' : ''}>{p.name}</a></li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <button className="collapse-btn" onClick={() => actions.setUi({ sidebarCollapsed: !collapsed })} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed}>
        <Icon name="panel" size={18} /><span className="collapsible">Collapse</span>
      </button>
    </aside>
  );
}
