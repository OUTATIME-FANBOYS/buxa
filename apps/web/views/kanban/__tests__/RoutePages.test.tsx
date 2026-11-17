import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@/providers/UiProvider';
import { buildSeed } from '@/logic/common';
import { AgentsPage, BoardsPage, HomePage, ProjectsPage, SettingsPage } from '../RoutePages';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => '/camp' }));

const seed = buildSeed();

describe('kanban route pages', () => {
  beforeEach(() => {
    h.store = {
      s: { ...seed, ui: { ...seed.ui, agentsEnabled: true } }, actions: {}, workspace: null, project: null, projects: [], wsTasks: [], kindOf: () => 'open',
      me: null, members: [], myRole: 'viewer', readOnly: true, userById: () => undefined, saveStatus: 'saved', sync: 'local', actions_: undefined,
    };
  });

  it('the home page renders the dashboard for the camp', () => {
    expect(renderToStaticMarkup(<UiProvider><HomePage camp={null} /></UiProvider>)).toContain('No workspace');
  });
  it('the boards page asks for a project when there are none', () => {
    expect(renderToStaticMarkup(<UiProvider><BoardsPage /></UiProvider>)).toContain('No projects yet');
  });
  it('the agents page explains that agents are off when they are switched off in Settings', () => {
    h.store = { ...h.store, s: { ...seed, ui: { ...seed.ui, agentsEnabled: false } } };
    expect(renderToStaticMarkup(<UiProvider><AgentsPage /></UiProvider>)).toContain('Agents are turned off');
  });
  it('the projects and settings pages render their views', () => {
    expect(renderToStaticMarkup(<UiProvider><ProjectsPage /></UiProvider>)).toContain('<h1>Projects</h1>');
    expect(renderToStaticMarkup(<UiProvider><SettingsPage /></UiProvider>)).toContain('<h1>Settings</h1>');
  });
});
