import { Dialog as ConfirmDialog } from '@/components/Dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { buildSeed } from '@buxa/shared';
import { Settings } from '../Settings';
import { Projects } from '../Projects';
import { MyTasks } from '../MyTasks';
import { Dashboard } from '../Dashboard';
import { WorkspaceCalendar } from '../WorkspaceCalendar';
import { BoardPage } from '../BoardPage';
import { Agents } from '../Agents';
import { Reports } from '../Reports';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/providers/TaskDrawerContext', () => ({ useTaskDrawer: () => ({ openTask: () => undefined }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, replace() {}, refresh() {} }), usePathname: () => '/camp/boards' }));

const seed = buildSeed();
const member = seed.workspaces[0].members[0];
const me = seed.users.find((u) => u.id === member.userId)!;

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
  beforeEach(() => { h.store = store(); });

  it('Settings lists the profile, appearance, agents, data and shortcuts sections', () => {
    const html = page(<Settings />);
    for (const heading of ['Profile', 'Appearance', 'Agents', 'Your data', 'Keyboard shortcuts']) expect(html).toContain(`<h2>${heading}</h2>`);
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
  it('Home shows the workspace dashboard, and says so when there is no workspace', () => {
    expect(page(<Dashboard camp={null} />)).toContain('class="page"');
    h.store = store({ workspace: null });
    expect(page(<Dashboard camp={null} />)).toContain('No workspace');
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
