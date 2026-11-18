import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { loadLogEntries, loadOnSiteEntries, loadPeopleOptions, loadVisitHistory } from '../loadAttendance';
import { settle } from '@buxa/domain';

const svc = vi.hoisted(() => ({
  attendance: { onSite: vi.fn(() => settle(() => ['on'])), log: vi.fn(() => settle(() => ['log'])), history: vi.fn(() => settle(() => ['visits'])) },
  people: { list: vi.fn(() => settle(() => ['people'])) },
}));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: svc }) }));

const ACTOR = { userId: 'u-1' } as unknown as Actor;

describe('attendance loaders', () => {
  beforeEach(() => vi.clearAllMocks());
  it('ask the attendance service for who is on site', async () => {
    expect(await loadOnSiteEntries(ACTOR)).toEqual(['on']);
    expect(svc.attendance.onSite).toHaveBeenCalledWith(ACTOR);
  });
  it('ask the attendance service for the log with the filter', async () => {
    const filter = { from: '2027-07-01', to: '2027-07-03' } as never;
    expect(await loadLogEntries(ACTOR, filter)).toEqual(['log']);
    expect(svc.attendance.log).toHaveBeenCalledWith(ACTOR, filter);
  });
  it('ask the people service for the names the log can filter by', async () => {
    expect(await loadPeopleOptions(ACTOR)).toEqual(['people']);
    expect(svc.people.list).toHaveBeenCalledWith(ACTOR);
  });
  it('ask the attendance service for one person’s visits', async () => {
    expect(await loadVisitHistory(ACTOR, 'p-1')).toEqual(['visits']);
    expect(svc.attendance.history).toHaveBeenCalledWith(ACTOR, 'p-1');
  });
});
