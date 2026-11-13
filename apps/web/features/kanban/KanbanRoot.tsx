import type { ReactNode } from 'react';
import { StoreProvider, useStore } from './store';
import { UiProvider } from '@/components/ui';
import { Auth } from './components/Auth';
import { Shell } from './components/Shell';
import { TaskDrawer } from './components/TaskDrawer';
import { useRoute } from './lib/router';
import { Dashboard } from './views/Dashboard';
import { MyTasks } from './views/MyTasks';
import { Projects } from './views/Projects';
import { BoardPage } from './views/BoardPage';
import { Team } from './views/Team';
import { Agents } from './views/Agents';
import { Reports } from './views/Reports';
import { Settings } from './views/Settings';
import { Empty } from '@/components/ui';
import { CalendarView } from './components/Views';

function WorkspaceCalendar() {
  const { wsTasks, readOnly, projects, project } = useStore();
  return (
    <div className="page"><header className="page-head"><div className="page-title"><h1>Calendar</h1><p className="muted">Deadlines across every project in this workspace</p></div></header>
      <CalendarView tasks={wsTasks.filter(t => !t.archived)} canCreate={!readOnly && projects.length > 0} projectId={project?.id} /></div>
  );
}

function Routes() {
  const route = useRoute();
  const { s } = useStore();
  if (!s.session.userId) return <Auth />;
  let page: ReactNode;
  switch (route.name) {
    case 'dashboard': page = <Dashboard />; break;
    case 'my-tasks': page = <MyTasks />; break;
    case 'projects': page = <Projects />; break;
    case 'board': page = <BoardPage projectId={route.id} />; break;
    case 'calendar': page = <WorkspaceCalendar />; break;
    case 'team': page = <Team />; break;
    case 'agents': page = s.ui.agentsEnabled ? <Agents /> : <Empty icon="agent" title="Agents are turned off" body="Turn them on in Settings to let AI agents propose work for you to approve." action={<a className="btn" href="#/settings">Open settings</a>} />; break;
    case 'reports': page = <Reports />; break;
    case 'settings': page = <Settings />; break;
    default: page = <Empty icon="alert" title="Page not found" body={`There is nothing at “/${route.path}”.`} action={<a className="btn" href="#/dashboard">Go to dashboard</a>} />;
  }
  return <Shell route={route}>{page}<TaskDrawer /></Shell>;
}

export default function App() {
  return <StoreProvider><UiProvider><Routes /></UiProvider></StoreProvider>;
}
