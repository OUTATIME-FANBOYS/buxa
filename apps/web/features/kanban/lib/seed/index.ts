import type { AppState } from '../../types';
import { buildActivity, buildNotices } from './activity';
import { AGENT_ID, CAMP_PROJECT_IDS, PROJECT, WORKSPACE } from './ids';
import { buildUsers, buildWorkspaces } from './people';
import { buildProjects } from './projects';
import { buildTasks } from './taskBuilder';
import { campTasks } from './tasksCamp';
import { registrationTasks } from './tasksRegistration';

export * from './ids';
export { defaultColumns } from './projects';

/** The demo camp: Camp Birchwood's staff-operations board, built fresh each time so ids and dates stay relative to today. */
export function buildSeed(): AppState {
  const users = buildUsers();
  const projects = buildProjects();
  const tasks = buildTasks([...registrationTasks(), ...campTasks()], projects);

  return {
    version: 1, users,
    accounts: users.filter(u => !u.agent).map(u => ({ email: u.email, hash: '', userId: u.id, demo: true })),
    workspaces: buildWorkspaces(), projects, tasks, activity: buildActivity(tasks), notices: buildNotices(tasks), savedFilters: [],
    agents: [{ userId: AGENT_ID, workspaceId: WORKSPACE.camp, model: 'Claude', purpose: 'Reads each camp project, flags unowned or overdue work, and proposes follow-ups.', scope: [...CAMP_PROJECT_IDS],
      trust: { create_task: 'auto', comment: 'auto', update_task: 'approve', move_task: 'approve', complete_task: 'approve' }, paused: false, moveRules: {}, approves: [] }],
    runs: [], proposals: [],
    session: { userId: null },
    ui: { workspaceId: WORKSPACE.camp, projectId: PROJECT.registration, view: 'board', theme: 'system', sidebarCollapsed: false, agentsEnabled: true },
  };
}
