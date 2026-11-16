import { describe, expect, it } from 'vitest';
import type { AttendanceEntry } from '@buxa/contracts';
import type { ActionOutcome } from '../actions/outcome';
import type { CheckOutResult } from '@/server/services';
import { canSubmitCheckOut, checkOutInputFor } from './checkOutInput';
import { CHECK_OUT_CLOSED, checkOutReducer, EMPTY_DRAFT, type CheckOutDraft, type CheckOutState } from './checkOutState';

const PERSON = '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f';
const GUARDIAN = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const entry = { id: 'e1' } as AttendanceEntry;
const chosen: CheckOutDraft = { collectedBy: GUARDIAN, overrideReason: null };

const open: CheckOutState = { phase: 'open', draft: EMPTY_DRAFT };
const submitting: CheckOutState = { phase: 'submitting', draft: chosen };
const done: CheckOutState = { phase: 'done', entry };
const refused = refusedWith({ ok: false, reason: 'pickup_required', canOverride: false, guardians: [] });
const failed: CheckOutState = { phase: 'failed', draft: EMPTY_DRAFT, message: 'x' };

function refusedWith(result: Extract<CheckOutResult, { ok: false }>): CheckOutState {
  return { phase: 'refused', draft: EMPTY_DRAFT, refusal: result };
}

describe('checkOutReducer: opening, closing and editing', () => {
  it('opens from closed and from done with an empty draft', () => {
    expect(checkOutReducer(CHECK_OUT_CLOSED, { type: 'open' })).toEqual(open);
    expect(checkOutReducer(done, { type: 'open' })).toEqual(open);
  });

  it('does not reopen a panel that is already open', () => {
    expect(checkOutReducer(open, { type: 'open' })).toBe(open);
  });

  it('closes from every phase except submitting', () => {
    expect(checkOutReducer(open, { type: 'close' })).toBe(CHECK_OUT_CLOSED);
    expect(checkOutReducer(refused, { type: 'close' })).toBe(CHECK_OUT_CLOSED);
    expect(checkOutReducer(failed, { type: 'close' })).toBe(CHECK_OUT_CLOSED);
    expect(checkOutReducer(submitting, { type: 'close' })).toBe(submitting);
  });

  it('keeps the draft when a guardian is chosen after a refusal, and goes back to open', () => {
    expect(checkOutReducer(refused, { type: 'draft', patch: { collectedBy: GUARDIAN } }))
      .toEqual({ phase: 'open', draft: { collectedBy: GUARDIAN, overrideReason: null } });
  });

  it('ignores edits while closed or done', () => {
    expect(checkOutReducer(CHECK_OUT_CLOSED, { type: 'draft', patch: { collectedBy: GUARDIAN } })).toBe(CHECK_OUT_CLOSED);
    expect(checkOutReducer(done, { type: 'draft', patch: { collectedBy: GUARDIAN } })).toBe(done);
  });
});

describe('checkOutReducer: submitting and answers', () => {
  it('submits from open, refused and failed, carrying the draft', () => {
    expect(checkOutReducer(open, { type: 'submitted' })).toEqual({ phase: 'submitting', draft: EMPTY_DRAFT });
    expect(checkOutReducer(refused, { type: 'submitted' }).phase).toBe('submitting');
    expect(checkOutReducer(failed, { type: 'submitted' }).phase).toBe('submitting');
  });

  it('does not submit when closed or done', () => {
    expect(checkOutReducer(CHECK_OUT_CLOSED, { type: 'submitted' })).toBe(CHECK_OUT_CLOSED);
    expect(checkOutReducer(done, { type: 'submitted' })).toBe(done);
  });

  it('accepts only the answer while submitting', () => {
    expect(checkOutReducer(submitting, { type: 'submitted' })).toBe(submitting);
    expect(checkOutReducer(submitting, { type: 'draft', patch: { collectedBy: null } })).toBe(submitting);
  });

  const answers: readonly [string, ActionOutcome<CheckOutResult>, CheckOutState][] = [
    ['an ok check-out', { kind: 'ok', value: { ok: true, entry, overridden: false } }, done],
    ['not on site', { kind: 'ok', value: { ok: false, reason: 'not_on_site' } },
      { phase: 'refused', draft: chosen, refusal: { ok: false, reason: 'not_on_site' } }],
    ['pickup required', { kind: 'ok', value: { ok: false, reason: 'pickup_required', canOverride: true, guardians: [] } },
      { phase: 'refused', draft: chosen, refusal: { ok: false, reason: 'pickup_required', canOverride: true, guardians: [] } }],
    ['pickup not authorised', { kind: 'ok', value: { ok: false, reason: 'pickup_not_authorised', canOverride: false, guardians: [] } },
      { phase: 'refused', draft: chosen, refusal: { ok: false, reason: 'pickup_not_authorised', canOverride: false, guardians: [] } }],
    ['override needs a reason', { kind: 'ok', value: { ok: false, reason: 'override_needs_reason' } },
      { phase: 'refused', draft: chosen, refusal: { ok: false, reason: 'override_needs_reason' } }],
    ['forbidden', { kind: 'forbidden', message: 'Your role cannot do this' }, { phase: 'failed', draft: chosen, message: 'Your role cannot do this' }],
    ['invalid input', { kind: 'invalid', message: 'Check the details.' }, { phase: 'failed', draft: chosen, message: 'Check the details.' }],
  ];

  it.each(answers)('turns %s into the right phase', (_name, outcome, expected) => {
    expect(checkOutReducer(submitting, { type: 'answered', outcome })).toEqual(expected);
  });

  it('ignores an answer when nothing was submitted', () => {
    expect(checkOutReducer(open, { type: 'answered', outcome: { kind: 'ok', value: { ok: false, reason: 'not_on_site' } } })).toBe(open);
  });
});

describe('canSubmitCheckOut', () => {
  it('lets an adult check out without anyone chosen', () => {
    expect(canSubmitCheckOut(false, EMPTY_DRAFT)).toBe(true);
  });

  it('needs a guardian or a written reason for a child', () => {
    expect(canSubmitCheckOut(true, EMPTY_DRAFT)).toBe(false);
    expect(canSubmitCheckOut(true, chosen)).toBe(true);
    expect(canSubmitCheckOut(true, { collectedBy: null, overrideReason: 'Parent on the phone' })).toBe(true);
    expect(canSubmitCheckOut(true, { collectedBy: null, overrideReason: '   ' })).toBe(false);
  });

  it('does not block when the screen cannot tell whether the person is a child (the server decides)', () => {
    expect(canSubmitCheckOut(null, EMPTY_DRAFT)).toBe(true);
  });
});

describe('checkOutInputFor', () => {
  it('sends only what is chosen, with the reason trimmed', () => {
    expect(checkOutInputFor(PERSON, EMPTY_DRAFT)).toEqual({ personId: PERSON });
    expect(checkOutInputFor(PERSON, chosen)).toEqual({ personId: PERSON, collectedByPersonId: GUARDIAN });
    expect(checkOutInputFor(PERSON, { collectedBy: null, overrideReason: '  Late bus  ' })).toEqual({ personId: PERSON, overrideReason: 'Late bus' });
    expect(checkOutInputFor(PERSON, { collectedBy: null, overrideReason: '   ' })).toEqual({ personId: PERSON });
  });
});
