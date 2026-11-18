import { Dialog as ConfirmDialog } from '@/components/components/export';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { AgentsPage, BoardsPage, HomePage, ProjectsPage, SettingsPage } from '@/components/views/kanban/export';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({
  useTaskDrawer: () => ({ openTask: () => undefined }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  usePathname: () => '/camp',
}));

const seed = buildSeed();

describe('kanban route pages', () => {
  beforeEach(() => {
    h.store = {
      s: { ...seed, ui: { ...seed.ui, agentsEnabled: true } },
      actions: {},
      workspace: null,
      project: null,
      projects: [],
      wsTasks: [],
      kindOf: () => 'open',
      me: null,
      members: [],
      myRole: 'viewer',
      readOnly: true,
      userById: () => undefined,
      saveStatus: 'saved',
      sync: 'local',
      actions_: undefined,
    };
  });

  it('the home page renders the dashboard for the camp', () => {
    const home = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <HomePage
          camp={{
            campId: 'o1',
            name: 'Lake Camp',
            firstName: 'Priya',
            canRename: false,
            people: 1,
            onSite: 0,
            checkedInToday: 0,
            validMemberships: 1,
            upcomingSessions: [],
            checkInsByDay: null,
            onSiteByAge: null,
            membershipStatus: null,
          }}
        />
      </UiProvider>,
    );
    expect(home).toContain('On site now');
    expect(home).not.toContain('No workspace');
  });
  it('the boards page asks for a project when there are none', () => {
    expect(
      renderToStaticMarkup(
        <UiProvider Dialog={ConfirmDialog}>
          <BoardsPage />
        </UiProvider>,
      ),
    ).toContain('No projects yet');
  });
  it('the agents page explains that agents are off when they are switched off in Settings', () => {
    h.store = { ...h.store, s: { ...seed, ui: { ...seed.ui, agentsEnabled: false } } };
    expect(
      renderToStaticMarkup(
        <UiProvider Dialog={ConfirmDialog}>
          <AgentsPage />
        </UiProvider>,
      ),
    ).toContain('Agents are turned off');
  });
  it('the projects and settings pages render their views', () => {
    expect(
      renderToStaticMarkup(
        <UiProvider Dialog={ConfirmDialog}>
          <ProjectsPage />
        </UiProvider>,
      ),
    ).toContain('<h1>Projects</h1>');
    expect(
      renderToStaticMarkup(
        <UiProvider Dialog={ConfirmDialog}>
          <SettingsPage />
        </UiProvider>,
      ),
    ).toContain('<h1>Settings</h1>');
  });
});
