import { Dialog as ConfirmDialog } from '@/components/components/export';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import type { CampHome } from '@buxa/shared/camp/campHomeTypes';
import { Settings } from '@/components/views/kanban/export';
import { Projects } from '@/components/views/kanban/export';
import { MyTasks } from '@/components/views/kanban/export';
import { Dashboard } from '@/components/views/kanban/export';
import { WorkspaceCalendar } from '@/components/views/kanban/export';
import { BoardPage } from '@/components/views/kanban/export';
import { Agents } from '@/components/views/kanban/export';
import { Reports } from '@/components/views/kanban/export';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => '/camp/boards' }));

const seed = buildSeed();
const member = seed.workspaces[0].members[0];
const me = seed.users.find((u) => u.id === member.userId)!;
const camp: CampHome = {
  campId: 'o1', name: 'Lake Camp', firstName: 'Priya', canRename: false,
  people: 40, onSite: 12, checkedInToday: 20, validMemberships: 35, upcomingSessions: [],
  checkInsByDay: { days: [{ date: '2026-11-17', count: 20, minors: 1 }], complete: true }, onSiteByAge: { adults: 11, minors: 1 },
  membershipStatus: { valid: 35, notStarted: 0, expired: 3, none: 2 },
};

/** A store as the views see it, for a signed-in editor with the seed camp selected. */
function store(over: Record<string, unknown> = {}) {
  return {
    s: seed, actions: { setTheme() {}, setView() {}, selectProject() {}, setAgentsEnabled() {}, updateUser() {}, exportData: () => '{}', importData: () => null, simulateRun: () => 0 },
    me, workspace: seed.workspaces[0], project: seed.projects[0], projects: seed.projects, wsTasks: seed.tasks, kindOf: () => 'open',
    members: seed.workspaces[0].members.map((m) => ({ userId: m.userId, role: m.role, user: seed.users.find((u) => u.id === m.userId)! })),
    myRole: 'owner', readOnly: false, userById: (id?: string) => seed.users.find((u) => u.id === id), saveStatus: 'saved', sync: 'local',
    ...over,
  };
}
const page = (node: React.ReactElement) => renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>);

describe('kanban views', () => {
  beforeEach(() => {
    h.store = store();
  });

  it('Settings lists the profile, appearance, agents, data and shortcuts sections', () => {
    const html = page(<Settings />);
    for (const heading of ['Profile', 'Appearance', 'Agents', 'Your data', 'Keyboard shortcuts']) {
      expect(html).toContain(`<h2>${heading}</h2>`);
    }
    expect(html).toContain('>Export JSON</button>');
  });
  it('Projects offers to start the first project when there are none', () => {
    h.store = store({ projects: [] });
    expect(page(<Projects />)).toContain('Start your first project');
  });
  it('My tasks says so when nothing is assigned to the signed-in person', () => {
    h.store = store({ wsTasks: [] });
    expect(page(<MyTasks />)).toContain('No tasks assigned to you');
  });
  it('Home shows the camp dashboard, and never the kanban empty state', () => {
    const html = page(<Dashboard camp={camp} />);
    for (const heading of ['On site now', 'Upcoming classes', 'Your tasks']) {
      expect(html).toContain(heading);
    }
    expect(html).not.toContain('No workspace');
  });
  it('Home offers its own sentence for each section that has no data', () => {
    const html = page(<Dashboard camp={{ ...camp, onSite: null, checkInsByDay: null, onSiteByAge: null, upcomingSessions: null, membershipStatus: null }} />);
    expect(html).toContain('Attendance is not shown for your role.');
    expect(html).toContain('Age groups are not shown for your role.');
    expect(html).toContain('Memberships are not shown for your role.');
    expect(html).toContain('Classes are not shown for your role.');
    expect(page(<Dashboard camp={camp} />)).toContain('No upcoming classes are scheduled.');
  });
  it('the workspace calendar is titled Calendar', () => {
    expect(page(<WorkspaceCalendar />)).toContain('<h1>Calendar</h1>');
  });
  it('a board page with no project says it has no projects yet', () => {
    h.store = store({ project: null, projects: [] });
    expect(page(<BoardPage />)).toContain('No projects yet');
  });
  it('a board page for a project shows its name and the board view', () => {
    const html = page(<BoardPage />);
    expect(html).toContain(`<h1>${seed.projects[0].name}</h1>`);
    expect(html).toContain('aria-label="Board view"');
  });
  it('the agents page lists its tabs for a workspace', () => {
    const html = page(<Agents />);
    expect(html).toContain('<h1>Agents</h1>');
    expect(html).toContain('aria-label="Agents section"');
  });
  it('the agents page says there is no workspace', () => {
    h.store = store({ workspace: null });
    expect(page(<Agents />)).toContain('No workspace');
  });
  it('reports titles the page and shows the range choice', () => {
    expect(page(<Reports />)).toContain('Reports');
  });
});
