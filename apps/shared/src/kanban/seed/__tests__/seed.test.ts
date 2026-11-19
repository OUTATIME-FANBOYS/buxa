import { describe, expect, it } from 'vitest';
import { buildActivity, buildNotices } from '../activity';
import { AGENT_ID, CAMP_PROJECT_IDS, PROJECT, TASK_TITLE, USER, WORKSPACE } from '../ids';
import { buildUsers, buildWorkspaces } from '../people';
import { buildProjects, defaultColumns } from '../projects';
import { buildTasks, doneSpec, spec } from '../taskBuilder';
import { campTasks } from '../tasksCamp';
import { registrationTasks } from '../tasksRegistration';
import { buildSeed } from '../buildSeed';

describe('seed ids', () => {
  it('gives every person and project a distinct id and lists the camp projects in sidebar order', () => {
    const people = Object.values(USER);
    expect(new Set(people).size).toBe(people.length);
    expect(CAMP_PROJECT_IDS).toEqual([
      PROJECT.registration,
      PROJECT.facilities,
      PROJECT.staffing,
      PROJECT.comms,
      PROJECT.programme,
    ]);
    expect(AGENT_ID).not.toBe(USER.rosa);
    expect(TASK_TITLE.welcomeEmail).toBe('Send parent welcome email');
  });
});

describe('seed people', () => {
  it('has the staff, one agent, and a camp workspace with an owner', () => {
    const users = buildUsers();
    expect(users.filter(u => u.agent).map(u => u.id)).toEqual([AGENT_ID]);
    expect(users.every(u => u.email.endsWith('@example.com') || u.agent)).toBe(true);
    const [workspace] = buildWorkspaces();
    expect(workspace.id).toBe(WORKSPACE.camp);
    expect(workspace.members.some(m => m.role === 'owner' && m.userId === USER.rosa)).toBe(true);
  });
});

describe('seed projects', () => {
  it('builds the five camp projects, each with the five default columns', () => {
    const projects = buildProjects();
    expect(projects.map(p => p.id)).toEqual(CAMP_PROJECT_IDS);
    for (const p of projects) {
      expect(p.columns.map(c => c.kind)).toEqual(['open', 'open', 'active', 'active', 'done']);
    }
  });
  it('defaultColumns uses the id generator for each slot', () => {
    const cols = defaultColumns(slot => `c${slot}`);
    expect(cols.map(c => c.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
    expect(cols[4].name).toBe('Done');
  });
});

describe('seed task builder', () => {
  it('turns a spec into a task in the right column with relative dates', () => {
    const projects = buildProjects();
    const [task] = buildTasks(
      [spec(PROJECT.registration, 2, 'Write form', 'high', USER.tom, 0, 3, ['family'])],
      projects,
    );
    expect(task.columnId).toBe(projects[0].columns[2].id);
    expect(task.priority).toBe('high');
    expect(task.assigneeId).toBe(USER.tom);
    expect(task.tags).toEqual(['family']);
    expect(task.start).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(task.completedAt).toBeUndefined();
  });
  it('marks a done spec as completed and gives subtasks, comments and attachments ids', () => {
    const projects = buildProjects();
    const specs = [doneSpec(PROJECT.staffing, 'Hire', 'low', USER.sam, -2, ['hr'])];
    const [task] = buildTasks(
      [
        {
          ...specs[0],
          extras: { ...specs[0].extras, subs: [['a', true]], comments: [[USER.rosa, 'ok']], files: ['x.pdf'] },
        },
      ],
      projects,
    );
    expect(task.completedAt).toBeDefined();
    expect(task.subtasks).toEqual([{ id: 't-1-sub-0', title: 'a', done: true }]);
    expect(task.comments[0]).toMatchObject({ id: 't-1-com-0', authorId: USER.rosa, body: 'ok' });
    expect(task.attachments[0]).toMatchObject({ id: 't-1-file-0', name: 'x.pdf' });
  });
  it('throws when a spec points at a column the project does not have', () => {
    expect(() => buildTasks([spec(PROJECT.registration, 4, 'x', 'low', undefined, null, null, [])], [])).toThrow(
      /missing column/,
    );
  });
});

describe('seed task lists', () => {
  it('registration and camp task specs only use camp projects', () => {
    const reg = registrationTasks();
    const camp = campTasks();
    expect(reg.length).toBeGreaterThan(0);
    expect(camp.length).toBeGreaterThan(0);
    for (const s of [...reg, ...camp]) {
      expect(CAMP_PROJECT_IDS).toContain(s.project);
    }
  });
});

describe('seed activity and notices', () => {
  it('builds activity and notices from the tasks', () => {
    const state = buildSeed();
    expect(buildActivity(state.tasks).length).toBeGreaterThan(0);
    expect(buildNotices(state.tasks).length).toBeGreaterThan(0);
  });
});

describe('buildSeed', () => {
  it('is the same board on every call (ids are fixed) and starts with no signed-in user', () => {
    const a = buildSeed();
    const b = buildSeed();
    expect(a.tasks.map(t => t.id)).toEqual(b.tasks.map(t => t.id));
    expect(a.session.userId).toBeNull();
    expect(a.ui.projectId).toBe(PROJECT.registration);
  });
});
