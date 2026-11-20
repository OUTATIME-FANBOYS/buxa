import { describe, expect, it } from 'vitest';
import type { Actor, FeedClass } from '@buxa/domain';
import { isHttpError } from '../http/errors';
import { createCalendarService } from './CalendarService';
import { hashCalendarToken, looksLikeCalendarToken } from './calendarToken';
import { InMemoryCalendarRepository } from './InMemoryCalendarRepository';

const ORG = '11111111-1111-4111-8111-111111111111';
const owner: Actor = { userId: 'user-owner', orgId: ORG, role: 'owner' };
const staff: Actor = { userId: 'user-staff', orgId: ORG, role: 'staff' };
const viewer: Actor = { userId: 'user-viewer', orgId: ORG, role: 'viewer' };
const NOW = new Date('2027-07-01T00:00:00Z');

const ROBOTICS: FeedClass = {
  id: '6f1c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f',
  className: 'Robotics',
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Lab 1',
};

function setup(sessions: FeedClass[] = [ROBOTICS]) {
  const repo = new InMemoryCalendarRepository(orgId => (orgId === ORG ? sessions : []));
  repo.seedCamp(ORG, 'Camp Pine');
  const service = createCalendarService({ repo });

  return { repo, service };
}

const unfold = (text: string) => text.replace(/\r\n[ \t]/g, '');

describe('calendar feed: tokens', () => {
  it('makes a 256-bit token that looks like a token, and stores only its hash', async () => {
    const { service, repo } = setup();
    const token = await service.rotateToken(owner);

    expect(looksLikeCalendarToken(token)).toBe(true);
    expect(token).toHaveLength(43);
    // The audit log names the action, never the token or its hash.
    expect(JSON.stringify(repo.audit)).not.toContain(token);
    expect(JSON.stringify(repo.audit)).not.toContain(hashCalendarToken(token).toString('hex'));
    expect(repo.audit.map(a => a.action)).toEqual(['calendar.token_rotate']);
  });

  it('gives a different token each time', async () => {
    const { service } = setup();

    expect(await service.rotateToken(owner)).not.toBe(await service.rotateToken(owner));
  });

  it('only an owner or admin may rotate: staff and viewers get a 403', async () => {
    const { service } = setup();

    for (const actor of [staff, viewer]) {
      const err = await service.rotateToken(actor).then(
        () => null,
        (e: unknown) => e,
      );
      expect(isHttpError(err) && err.statusCode).toBe(403);
    }
  });

  it('rotating makes the old URL stop working at once and the new one work', async () => {
    const { service } = setup();
    const first = await service.rotateToken(owner);
    expect(await service.feed(first, NOW)).not.toBeNull();

    const second = await service.rotateToken(owner);

    expect(await service.feed(first, NOW)).toBeNull();
    expect(await service.feed(second, NOW)).not.toBeNull();
  });

  it('refuses an unknown, a malformed and an empty token with the same null (no camp is revealed)', async () => {
    const { service } = setup();
    await service.rotateToken(owner);

    expect(await service.feed('A'.repeat(43), NOW)).toBeNull();
    expect(await service.feed('too-short', NOW)).toBeNull();
    expect(await service.feed('', NOW)).toBeNull();
    expect(await service.feed(`${'A'.repeat(42)}!`, NOW)).toBeNull();
  });
});

describe('calendar feed: content', () => {
  it('serves the camp sessions as a calendar, with the class name and UTC times', async () => {
    const { service } = setup();
    const token = await service.rotateToken(owner);

    const text = await service.feed(token, NOW);
    const out = unfold(text ?? '');

    expect(text?.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(out).toContain('X-WR-CALNAME:Camp Pine');
    expect(out).toContain('SUMMARY:Robotics');
    expect(out).toContain('DTSTART:20270704T230000Z');
    expect(out).toContain('DTEND:20270705T020000Z');
    expect(out).toContain('DTSTAMP:20270701T000000Z');
  });

  it('gives a valid empty calendar for a camp with no sessions', async () => {
    const { service } = setup([]);
    const token = await service.rotateToken(owner);

    const text = await service.feed(token, NOW);

    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('END:VCALENDAR');
    expect(text).not.toContain('BEGIN:VEVENT');
  });

  it('refuses an archived camp: the same answer as a bad token, even with the right token', async () => {
    const { service, repo } = setup();
    const token = await service.rotateToken(owner);
    repo.archive(ORG);

    expect(await service.feed(token, NOW)).toBeNull();
  });
});
