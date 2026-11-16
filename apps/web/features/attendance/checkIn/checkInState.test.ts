import { describe, expect, it } from 'vitest';
import type { AttendanceEntry, PersonSummary } from '@buxa/contracts';
import type { ActionOutcome } from '../actions/outcome';
import type { PersonCard } from '../lib/card';
import type { CheckInResult } from '@/server/services';
import { CHECK_IN_IDLE, checkInReducer, lookupEvent, type CheckInState } from './checkInState';

const person: PersonSummary = {
  id: '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f', givenName: 'Ada', familyName: 'Lovelace', preferredName: null,
  roles: ['camper'], status: 'valid', onSite: false, archived: false,
};
const card: PersonCard = { person, onSiteSince: null };
const entry = { id: 'e1', personId: person.id } as AttendanceEntry;
const ready: CheckInState = { phase: 'ready', card, method: 'qr' };
const submitting: CheckInState = { phase: 'submitting', card, method: 'qr' };

describe('checkInReducer: selecting and resetting', () => {
  it('shows a person as ready to check in', () => {
    expect(checkInReducer(CHECK_IN_IDLE, { type: 'selected', card, method: 'search' })).toEqual({ phase: 'ready', card, method: 'search' });
  });

  it('shows an unknown code neutrally, from any phase', () => {
    expect(checkInReducer(ready, { type: 'unknown' })).toEqual({ phase: 'unknown' });
    expect(checkInReducer({ phase: 'done', card, entry, overridden: false }, { type: 'unknown' })).toEqual({ phase: 'unknown' });
  });

  it('returns to idle on reset, except while a check-in is being written', () => {
    expect(checkInReducer(ready, { type: 'reset' })).toEqual(CHECK_IN_IDLE);
    expect(checkInReducer(submitting, { type: 'reset' })).toBe(submitting);
  });

  it('keeps a new scan from replacing a check-in that is in flight', () => {
    expect(checkInReducer(submitting, { type: 'selected', card, method: 'qr' })).toBe(submitting);
    expect(checkInReducer(submitting, { type: 'unknown' })).toBe(submitting);
    expect(checkInReducer(submitting, { type: 'error', message: 'x' })).toBe(submitting);
  });

  it('maps a lookup answer to the matching event', () => {
    expect(lookupEvent({ kind: 'unknown' }, 'qr')).toEqual({ type: 'unknown' });
    expect(lookupEvent({ kind: 'person', card }, 'qr')).toEqual({ type: 'selected', card, method: 'qr' });
  });
});

describe('checkInReducer: submitting', () => {
  it.each([
    ['ready', ready],
    ['refused', { phase: 'refused', card, method: 'qr', refusal: { ok: false, reason: 'archived' } } as CheckInState],
    ['failed', { phase: 'failed', card, method: 'qr', message: 'x' } as CheckInState],
  ] as const)('submits from %s', (_name, from) => {
    expect(checkInReducer(from, { type: 'submitted' })).toEqual(submitting);
  });

  it.each([
    ['idle', CHECK_IN_IDLE],
    ['unknown', { phase: 'unknown' } as CheckInState],
  ] as const)('does not submit from %s', (_name, from) => {
    expect(checkInReducer(from, { type: 'submitted' })).toBe(from);
  });
});

describe('checkInReducer: answers', () => {
  const answers: readonly [string, ActionOutcome<CheckInResult>, CheckInState][] = [
    ['an ok check-in', { kind: 'ok', value: { ok: true, entry, overridden: false } },
      { phase: 'done', card, entry, overridden: false }],
    ['an override that went through', { kind: 'ok', value: { ok: true, entry, overridden: true } },
      { phase: 'done', card, entry, overridden: true }],
    ['already on site', { kind: 'ok', value: { ok: false, reason: 'already_on_site', since: '2026-11-13T09:12:00Z' } },
      { phase: 'refused', card, method: 'qr', refusal: { ok: false, reason: 'already_on_site', since: '2026-11-13T09:12:00Z' } }],
    ['not valid, override offered', { kind: 'ok', value: { ok: false, reason: 'not_valid', status: 'expired', canOverride: true } },
      { phase: 'refused', card, method: 'qr', refusal: { ok: false, reason: 'not_valid', status: 'expired', canOverride: true } }],
    ['override without reason', { kind: 'ok', value: { ok: false, reason: 'override_needs_reason' } },
      { phase: 'refused', card, method: 'qr', refusal: { ok: false, reason: 'override_needs_reason' } }],
    ['archived', { kind: 'ok', value: { ok: false, reason: 'archived' } },
      { phase: 'refused', card, method: 'qr', refusal: { ok: false, reason: 'archived' } }],
    ['forbidden', { kind: 'forbidden', message: 'Your role cannot do this' },
      { phase: 'failed', card, method: 'qr', message: 'Your role cannot do this' }],
    ['invalid input', { kind: 'invalid', message: 'Check the details.' },
      { phase: 'failed', card, method: 'qr', message: 'Check the details.' }],
  ];

  it.each(answers)('turns %s into the right phase', (_name, outcome, expected) => {
    expect(checkInReducer(submitting, { type: 'answered', outcome })).toEqual(expected);
  });

  it('ignores an answer when no check-in was submitted', () => {
    expect(checkInReducer(ready, { type: 'answered', outcome: { kind: 'forbidden', message: 'x' } })).toBe(ready);
  });
});
