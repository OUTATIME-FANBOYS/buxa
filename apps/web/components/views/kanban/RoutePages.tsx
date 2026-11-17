'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { CampHome } from '@buxa/server/composers/index.server';
import { ROUTES, boardPath } from '@/config/routes';
import { Empty } from '@/components/components/export';
import { useStore } from '@buxa/middleware/providers/providers';
import { Agents } from './Agents';
import { BoardPage } from './BoardPage';
import { Dashboard } from './Dashboard';
import { MyTasks } from './MyTasks';
import { Projects } from './Projects';
import { Reports } from './Reports';
import { Settings } from './Settings';
import { WorkspaceCalendar } from './WorkspaceCalendar';

/** Home: one page for the camp (when there is one) and its staff tasks. */
export function HomePage({ camp }: { camp: CampHome | null }) {
  return <Dashboard camp={camp} />;
}

export function TasksPage() { return <MyTasks />; }

export function ProjectsPage() { return <Projects />; }

/** /camp/boards: opens the selected project's board, or the first one. */
export function BoardsPage() {
  const router = useRouter();
  const { projects, project } = useStore();
  const target = project ?? projects[0];
  useEffect(() => { if (target) router.replace(boardPath(target.id)); }, [target?.id, router]); // eslint-disable-line
  if (target) return <p className="muted" role="status" style={{ padding: 24 }}>Opening board…</p>;
  return <Empty icon="folder" title="No projects yet" body="Create a project to get your first board." action={<Link className="btn btn-primary" href={ROUTES.projects}>Go to projects</Link>} />;
}

export function BoardRoutePage({ projectId }: { projectId: string }) { return <BoardPage projectId={projectId} />; }

export function CalendarPage() { return <WorkspaceCalendar />; }

/** The agents page, or a plain note when agents are turned off in Settings. */
export function AgentsPage() {
  const { s } = useStore();
  if (s.ui.agentsEnabled) return <Agents />;
  return <Empty icon="agent" title="Agents are turned off" body="Turn them on in Settings to let AI agents propose work for you to approve." action={<Link className="btn" href={ROUTES.settings}>Open settings</Link>} />;
}

export function ReportsPage() { return <Reports />; }

export function SettingsPage() { return <Settings />; }
