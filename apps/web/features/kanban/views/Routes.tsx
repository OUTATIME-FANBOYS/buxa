import type { ReactNode } from 'react';
import { Empty } from '@/components/ui';
import { useStore } from '../state/store';
import { useRoute } from '../lib/router';
import { Auth } from '../components/Auth';
import { Shell } from '../components/shell/Shell';
import { TaskDrawer } from '../components/drawer/TaskDrawer';
import { Agents } from './Agents';
import { BoardPage } from './BoardPage';
import { Dashboard } from './Dashboard';
import { MyTasks } from './MyTasks';
import { Projects } from './Projects';
import { Reports } from './Reports';
import { Settings } from './Settings';
import { Team } from './Team';
import { WorkspaceCalendar } from './WorkspaceCalendar';

const AgentsOff = () => <Empty icon="agent" title="Agents are turned off" body="Turn them on in Settings to let AI agents propose work for you to approve." action={<a className="btn" href="#/settings">Open settings</a>} />;

/** Signed out: the sign-in screen. Signed in: the shell around whichever page the hash route names. */
export function Routes() {
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
    case 'agents': page = s.ui.agentsEnabled ? <Agents /> : <AgentsOff />; break;
    case 'reports': page = <Reports />; break;
    case 'settings': page = <Settings />; break;
    default: page = <Empty icon="alert" title="Page not found" body={`There is nothing at “/${route.path}”.`} action={<a className="btn" href="#/dashboard">Go to dashboard</a>} />;
  }
  return <Shell route={route}>{page}<TaskDrawer /></Shell>;
}
