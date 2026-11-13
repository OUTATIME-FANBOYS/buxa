import type { Route } from '../../lib/router';

export const NAV: { key: Route['name']; label: string; icon: string; to: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
  { key: 'my-tasks', label: 'My Tasks', icon: 'tasks', to: '/my-tasks' },
  { key: 'projects', label: 'Projects', icon: 'folder', to: '/projects' },
  { key: 'board', label: 'Kanban Boards', icon: 'kanban', to: '/board' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar', to: '/calendar' },
  { key: 'team', label: 'Team', icon: 'users', to: '/team' },
  { key: 'agents', label: 'Agents', icon: 'agent', to: '/agents' },
  { key: 'reports', label: 'Reports', icon: 'chart', to: '/reports' },
  { key: 'settings', label: 'Settings', icon: 'settings', to: '/settings' },
];
