import { describe, expect, it } from 'vitest';
import type { AttendanceEntry, PersonSummary } from '@buxa/contracts';
import type { OnSiteEntry } from '@/server/services';
import type { PersonCard } from './card';
import { cardsFor, lookupFor } from './card';
import { checkInRefusalCopy, checkOutRefusalCopy } from './refusals';
import { displayName } from './name';
import { toOnSiteRow, onSiteSummary } from './onSiteView';
import { checkInAnnouncement } from '../checkIn/announce';
import { CHECK_IN_IDLE } from '../checkIn/checkInState';
import { STATUS_DISPLAY } from './status';

const ada: PersonSummary = {
  id: 'p-ada', givenName: 'Ada', familyName: 'Lovelace', preferredName: null, roles: ['camper'], status: 'valid', onSite: true, archived: false,
};
const sam: PersonSummary = { ...ada, id: 'p-sam', givenName: 'Sam', familyName: 'Lee', preferredName: 'Sammy', status: 'expired' };
const entry = (personId: string, checkedInAt: string) => ({ id: `e-${personId}`, personId, checkedInAt }) as AttendanceEntry;

describe('displayName', () => {
  it('uses the preferred name when there is one', () => {
    expect(displayName(sam)).toBe('Sammy Lee');
    expect(displayName(ada)).toBe('Ada Lovelace');
  });
});

describe('cards and lookups', () => {
  const onSite = [{ entry: entry('p-ada', '2026-11-13T08:12:00Z'), person: ada, isMinor: true, pickupOptions: [] }] as OnSiteEntry[];

  it('attaches the arrival time of people on site and null to the rest', () => {
    expect(cardsFor([ada, sam], onSite)).toEqual([
      { person: ada, onSiteSince: '2026-11-13T08:12:00Z' },
      { person: sam, onSiteSince: null },
    ]);
  });

  it('answers a scan of an unknown code with one neutral unknown', () => {
    expect(lookupFor({ kind: 'unknown' }, onSite)).toEqual({ kind: 'unknown' });
  });

  it('answers a scan of a person with their card', () => {
    expect(lookupFor({ kind: 'person', person: ada }, onSite)).toEqual({ kind: 'person', card: { person: ada, onSiteSince: '2026-11-13T08:12:00Z' } });
  });
});

describe('status words', () => {
  it('gives every status a word, so colour is never the only signal', () => {
    expect(Object.values(STATUS_DISPLAY).map(s => s.label)).toEqual(['Valid', 'Not started yet', 'Expired', 'Revoked', 'No membership']);
  });
});

describe('check-in refusal copy', () => {
  it('shows the camp-local time of an earlier check-in', () => {
    expect(checkInRefusalCopy({ ok: false, reason: 'already_on_site', since: '2026-11-13T20:30:00Z' }, 'Asia/Kolkata').body)
      .toBe('Checked in at 02:00. Nothing to do.');
  });

  it('offers an override only when the actor may give one', () => {
    expect(checkInRefusalCopy({ ok: false, reason: 'not_valid', status: 'expired', canOverride: true }, 'UTC').body).toContain('An admin can');
    expect(checkInRefusalCopy({ ok: false, reason: 'not_valid', status: 'expired', canOverride: false }, 'UTC').body).not.toContain('An admin can');
  });

  it.each([
    ['not_started', 'Not started yet'],
    ['expired', 'Expired'],
    ['revoked', 'Revoked'],
    ['none', 'No membership'],
  ] as const)('titles a %s refusal "%s"', (status, title) => {
    expect(checkInRefusalCopy({ ok: false, reason: 'not_valid', status, canOverride: false }, 'UTC').title).toBe(title);
  });

  it('explains archived and reason-needed refusals', () => {
    expect(checkInRefusalCopy({ ok: false, reason: 'archived' }, 'UTC').title).toBe('Archived');
    expect(checkInRefusalCopy({ ok: false, reason: 'override_needs_reason' }, 'UTC').title).toBe('Write a reason');
  });
});

describe('check-out refusal copy', () => {
  it('names the guardian problem and offers an override only with the right to give one', () => {
    expect(checkOutRefusalCopy({ ok: false, reason: 'pickup_required', canOverride: true, guardians: [] }).body).toContain('An admin can');
    expect(checkOutRefusalCopy({ ok: false, reason: 'pickup_required', canOverride: false, guardians: [] }).body).toContain('Ask an admin');
    expect(checkOutRefusalCopy({ ok: false, reason: 'pickup_required', canOverride: false, guardians: [{ personId: 'g', name: 'G', relationship: 'Parent' }] }).title)
      .toBe('Choose who is collecting');
  });

  it('says a person is not on site', () => {
    expect(checkOutRefusalCopy({ ok: false, reason: 'not_on_site' }).title).toBe('Not on site');
  });
});

describe('on-site view', () => {
  it('turns an on-site entry into camp-local words', () => {
    const row = toOnSiteRow({ entry: entry('p-ada', '2026-11-13T20:30:00Z'), person: ada, isMinor: true, pickupOptions: [] } as OnSiteEntry, 'Asia/Kolkata');
    expect(row).toEqual({ personId: 'p-ada', name: 'Ada Lovelace', arrivedAt: '02:00', isMinor: true, pickupOptions: [] });
  });

  it('counts people in the header wording', () => {
    expect(onSiteSummary(1)).toBe('1 person on site now');
    expect(onSiteSummary(0)).toBe('0 people on site now');
    expect(onSiteSummary(3)).toBe('3 people on site now');
  });
});

describe('check-in announcements', () => {
  const card: PersonCard = { person: sam, onSiteSince: null };

  it('says nothing while idle and names the status in words when a person is ready', () => {
    expect(checkInAnnouncement(CHECK_IN_IDLE, 'UTC')).toBe('');
    expect(checkInAnnouncement({ phase: 'ready', card, method: 'qr' }, 'UTC')).toBe('Sammy Lee. Expired.');
  });

  it('announces an unknown code, a check-in time in the camp zone, and a refusal', () => {
    expect(checkInAnnouncement({ phase: 'unknown' }, 'UTC')).toBe('Code not recognised.');
    expect(checkInAnnouncement({ phase: 'done', card, entry: entry('p-sam', '2026-11-13T20:30:00Z'), overridden: false }, 'Asia/Kolkata'))
      .toBe('Sammy Lee checked in at 02:00.');
    expect(checkInAnnouncement({ phase: 'refused', card, method: 'qr', refusal: { ok: false, reason: 'archived' } }, 'UTC'))
      .toContain('Archived.');
  });
});
