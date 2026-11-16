import { describe, expect, it } from 'vitest';
import { ROUTES, boardPath, isCampPath, personPath } from './routes';

describe('ROUTES', () => {
  it('keeps every address unique', () => {
    const values = Object.values(ROUTES);
    expect(new Set(values).size).toBe(values.length);
  });

  it('puts every work page and camp operations page under /camp', () => {
    for (const path of Object.values(ROUTES).filter(p => p !== ROUTES.home && p !== ROUTES.signIn)) expect(isCampPath(path)).toBe(true);
  });

  it('gives the task pages their /camp addresses', () => {
    expect([ROUTES.camp, ROUTES.tasks, ROUTES.projects, ROUTES.boards, ROUTES.calendar, ROUTES.agents, ROUTES.reports, ROUTES.settings]).toEqual([
      '/camp', '/camp/tasks', '/camp/projects', '/camp/boards', '/camp/calendar', '/camp/agents', '/camp/reports', '/camp/settings',
    ]);
  });

  it('no longer defines the old kanban address', () => {
    expect(Object.values(ROUTES)).not.toContain('/kanban');
    expect(ROUTES).not.toHaveProperty('kanban');
  });
});

describe('boardPath', () => {
  it('builds the board address of one project under /camp/boards', () => {
    expect(boardPath('p-1')).toBe('/camp/boards/p-1');
  });

  it('encodes the id, so it cannot change the address', () => {
    expect(boardPath('a/b?c')).toBe('/camp/boards/a%2Fb%3Fc');
  });
});

describe('personPath', () => {
  it('still builds a person address under /camp/people', () => {
    expect(personPath('42')).toBe('/camp/people/42');
  });
});
