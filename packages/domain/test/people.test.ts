import { describe, expect, it } from 'vitest';
import {
  ageOn, credentialPayload, decideCheckIn, decideCheckOut, isCredentialToken, isLocalDate, isMinor, isTimeZone, matchesName,
  membershipStatus, normalizeForSearch, parseCredentialPayload, personAccess, toLocalDate, type MembershipPeriod,
} from '../src';

const season = (startsOn: string, endsOn: string, revokedAt: string | null = null): MembershipPeriod => ({ startsOn, endsOn, revokedAt });

describe('membershipStatus', () => {
  const m = season('2027-06-01', '2027-08-31');
  it.each([
    ['2027-05-31', 'not_started'], ['2027-06-01', 'valid'], ['2027-08-31', 'valid'], ['2027-09-01', 'expired'], ['2027-07-15', 'valid'],
  ])('on %s it is %s', (day, expected) => expect(membershipStatus(m, day)).toBe(expected));
  it('revoked wins over every date', () => expect(membershipStatus(season('2027-06-01', '2027-08-31', '2027-07-01T10:00:00Z'), '2027-07-02')).toBe('revoked'));
  it('a one-day membership is valid that day only', () => {
    const one = season('2028-02-29', '2028-02-29');
    expect([membershipStatus(one, '2028-02-28'), membershipStatus(one, '2028-02-29'), membershipStatus(one, '2028-03-01')]).toEqual(['not_started', 'valid', 'expired']);
  });
});

describe('personAccess', () => {
  const past = season('2026-06-01', '2026-08-31'), now = season('2027-06-01', '2027-08-31'), later = season('2028-06-01', '2028-08-31');
  it('has no status without memberships', () => expect(personAccess([], '2027-07-01')).toEqual({ status: 'none' }));
  it('is valid if any membership is valid, whatever the order', () => {
    expect(personAccess([past, now, later], '2027-07-01')).toEqual({ status: 'valid', membership: now });
    expect(personAccess([now, past], '2027-07-01').status).toBe('valid');
  });
  it('overlapping memberships: one valid is enough', () => expect(personAccess([season('2027-01-01', '2027-12-31'), season('2027-07-01', '2027-07-02')], '2027-12-31').status).toBe('valid'));
  it('shows what is coming before what ended', () => expect(personAccess([past, later], '2027-01-01')).toEqual({ status: 'not_started', membership: later }));
  it('shows the most recently ended membership', () => {
    const older = season('2025-06-01', '2025-08-31');
    expect(personAccess([older, past], '2027-01-01').membership).toBe(past);
  });
  it('shows revoked only when nothing else applies', () => {
    const revoked = season('2027-06-01', '2027-08-31', '2027-06-02T00:00:00Z');
    expect(personAccess([revoked], '2027-07-01').status).toBe('revoked');
    expect(personAccess([revoked, now], '2027-07-01').status).toBe('valid');
  });
});

describe('local dates', () => {
  it('validates real calendar days', () => {
    expect(isLocalDate('2028-02-29')).toBe(true);
    for (const bad of ['2027-02-29', '2027-13-01', '2027-1-1', '', 'x', 20270101, null]) expect(isLocalDate(bad)).toBe(false);
  });
  it('the same instant is different days in different zones (time-zone midnight)', () => {
    const instant = new Date('2027-07-01T03:30:00Z');
    expect(toLocalDate(instant, 'America/Los_Angeles')).toBe('2027-06-30');
    expect(toLocalDate(instant, 'Asia/Kolkata')).toBe('2027-07-01');
    expect(toLocalDate(instant, 'UTC')).toBe('2027-07-01');
  });
  it('recognises zone names', () => { expect(isTimeZone('Europe/Paris')).toBe(true); expect(isTimeZone('Mars/Base')).toBe(false); expect(isTimeZone('')).toBe(false); });
});

describe('minor rule', () => {
  it('counts whole years', () => {
    expect(ageOn('2010-07-02', '2028-07-01')).toBe(17);
    expect(ageOn('2010-07-01', '2028-07-01')).toBe(18);
  });
  it('under 18 is a minor on the day before the birthday, an adult on it', () => {
    expect(isMinor({ dateOfBirth: '2010-07-02', roles: ['camper'] }, '2028-07-01')).toBe(true);
    expect(isMinor({ dateOfBirth: '2010-07-01', roles: ['camper'] }, '2028-07-01')).toBe(false);
  });
  it('a camper with no birth date is treated as a minor; other roles without one are not', () => {
    expect(isMinor({ dateOfBirth: null, roles: ['camper'] }, '2027-07-01')).toBe(true);
    expect(isMinor({ dateOfBirth: null, roles: ['guardian'] }, '2027-07-01')).toBe(false);
  });
  it('a known birth date beats the camper role', () => expect(isMinor({ dateOfBirth: '1990-01-01', roles: ['camper'] }, '2027-07-01')).toBe(false));
});

describe('decideCheckIn', () => {
  const base = { onSiteSince: null, canOverride: false };
  it('allows a valid person', () => expect(decideCheckIn({ ...base, status: 'valid' })).toEqual({ kind: 'allow' }));
  it.each(['expired', 'not_started', 'revoked', 'none'] as const)('refuses %s and says whether an override is possible', status => {
    expect(decideCheckIn({ ...base, status })).toEqual({ kind: 'refuse', reason: 'not_valid', status, canOverride: false });
    expect(decideCheckIn({ ...base, status, canOverride: true })).toMatchObject({ canOverride: true });
  });
  it('never creates a second check-in, even for a valid person or an override', () => {
    expect(decideCheckIn({ ...base, status: 'valid', onSiteSince: '2027-07-01T09:12:00Z' })).toEqual({ kind: 'refuse', reason: 'already_on_site', since: '2027-07-01T09:12:00Z' });
    expect(decideCheckIn({ status: 'expired', onSiteSince: 'x', canOverride: true, overrideReason: 'ok' }).kind).toBe('refuse');
  });
  it('an admin may override with a reason, which is trimmed', () => expect(decideCheckIn({ status: 'expired', onSiteSince: null, canOverride: true, overrideReason: '  paid at the door ' })).toEqual({ kind: 'allow_override', reason: 'paid at the door' }));
  it('an override needs a real reason', () => expect(decideCheckIn({ status: 'expired', onSiteSince: null, canOverride: true, overrideReason: '   ' })).toEqual({ kind: 'refuse', reason: 'override_needs_reason' }));
  it('staff cannot override, reason or not', () => expect(decideCheckIn({ status: 'expired', onSiteSince: null, canOverride: false, overrideReason: 'please' })).toMatchObject({ reason: 'not_valid', canOverride: false }));
});

describe('decideCheckOut', () => {
  const guardian = { personId: 'g', canPickup: true };
  const child = { onSite: true, isMinor: true, collectedBy: guardian, canOverride: false };
  it('refuses someone who is not on site', () => expect(decideCheckOut({ ...child, onSite: false })).toEqual({ kind: 'refuse', reason: 'not_on_site' }));
  it('adults leave freely', () => expect(decideCheckOut({ ...child, isMinor: false, collectedBy: null })).toEqual({ kind: 'allow' }));
  it('a child leaves with an authorised guardian', () => expect(decideCheckOut(child)).toEqual({ kind: 'allow' }));
  it('a child cannot leave with nobody chosen', () => expect(decideCheckOut({ ...child, collectedBy: null })).toEqual({ kind: 'refuse', reason: 'pickup_required', canOverride: false }));
  it('a guardian without can_pickup is refused', () => expect(decideCheckOut({ ...child, collectedBy: { personId: 'g', canPickup: false } })).toEqual({ kind: 'refuse', reason: 'pickup_not_authorised', canOverride: false }));
  it('an admin may override with a reason; staff may not', () => {
    const unauthorised = { ...child, collectedBy: { personId: 'x', canPickup: false } };
    expect(decideCheckOut({ ...unauthorised, canOverride: true, overrideReason: 'court order seen' })).toEqual({ kind: 'allow_override', reason: 'court order seen' });
    expect(decideCheckOut({ ...unauthorised, canOverride: true, overrideReason: ' ' })).toEqual({ kind: 'refuse', reason: 'override_needs_reason' });
    expect(decideCheckOut({ ...unauthorised, overrideReason: 'please' })).toMatchObject({ reason: 'pickup_not_authorised' });
  });
});

describe('search', () => {
  it('ignores case, accents and spacing', () => expect(normalizeForSearch('  José   GARCÍA ')).toBe('jose garcia'));
  const p = { givenName: 'Zoë', familyName: 'Müller-Ñandú', preferredName: 'Zo' };
  it('matches given, family or preferred names, every word required', () => {
    expect(matchesName(p, 'zoe')).toBe(true);
    expect(matchesName(p, 'MULLER')).toBe(true);
    expect(matchesName(p, 'nandu zoe')).toBe(true);
    expect(matchesName(p, 'zoe smith')).toBe(false);
    expect(matchesName(p, '   ')).toBe(false);
  });
});

describe('credential payload', () => {
  const token = 'A'.repeat(22);
  it('round-trips and ignores a scanner\'s trailing newline', () => {
    expect(parseCredentialPayload(credentialPayload(token))).toBe(token);
    expect(parseCredentialPayload(`${credentialPayload(token)}\r\n`)).toBe(token);
  });
  it('rejects anything else with the same null', () => {
    for (const raw of ['', token, 'bx1.short', `bx1.${'A'.repeat(23)}`, `other.${token}`, `bx1.${'!'.repeat(22)}`]) expect(parseCredentialPayload(raw)).toBeNull();
  });
  it('token shape', () => { expect(isCredentialToken(token)).toBe(true); expect(isCredentialToken('a'.repeat(21))).toBe(false); });
});
