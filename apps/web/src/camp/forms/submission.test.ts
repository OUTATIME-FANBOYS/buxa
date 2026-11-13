import { describe, expect, it } from 'vitest';
import { editing, hasErrors, submissionReducer, type Submission, type SubmissionAction } from './submission';

type F = 'email' | 'name';
const step = (s: Submission<F>, a: SubmissionAction<F>) => submissionReducer<F>(s, a);
const SUBMITTING: Submission<F> = { status: 'submitting' };
const FAILED: Submission<F> = { status: 'failed', message: 'nope' };
const SUCCEEDED: Submission<F> = { status: 'succeeded', message: 'done' };

describe('submission state machine', () => {
  describe('editing', () => {
    it('submit → submitting', () => expect(step(editing(), { type: 'submit' })).toEqual(SUBMITTING));
    it('invalid → editing with the errors', () => expect(step(editing(), { type: 'invalid', errors: { email: 'bad' } })).toEqual(editing({ email: 'bad' })));
    it('ignores edit, failed, succeeded and reset (they only make sense while submitting or after)', () => {
      const s = editing<F>({ name: 'x' });
      for (const a of [{ type: 'edit' }, { type: 'failed', message: 'm' }, { type: 'succeeded' }, { type: 'reset' }] as SubmissionAction<F>[]) expect(step(s, a)).toBe(s);
    });
  });

  describe('submitting', () => {
    it('succeeded → succeeded (keeps the message)', () => expect(step(SUBMITTING, { type: 'succeeded', message: 'ok' })).toEqual({ status: 'succeeded', message: 'ok' }));
    it('failed → failed', () => expect(step(SUBMITTING, { type: 'failed', message: 'boom' })).toEqual({ status: 'failed', message: 'boom' }));
    it('invalid (server rejected a field) → editing with that error', () => expect(step(SUBMITTING, { type: 'invalid', errors: { name: 'taken' } })).toEqual(editing({ name: 'taken' })));
    it('ignores a second submit (no double submit) and edits', () => {
      expect(step(SUBMITTING, { type: 'submit' })).toBe(SUBMITTING);
      expect(step(SUBMITTING, { type: 'edit' })).toBe(SUBMITTING);
      expect(step(SUBMITTING, { type: 'reset' })).toBe(SUBMITTING);
    });
  });

  describe('failed', () => {
    it('edit or reset → editing, clearing the failure', () => {
      expect(step(FAILED, { type: 'edit' })).toEqual(editing());
      expect(step(FAILED, { type: 'reset' })).toEqual(editing());
    });
    it('submit → submitting (retry)', () => expect(step(FAILED, { type: 'submit' })).toEqual(SUBMITTING));
    it('invalid → editing with errors', () => expect(step(FAILED, { type: 'invalid', errors: { email: 'x' } })).toEqual(editing({ email: 'x' })));
  });

  describe('succeeded', () => {
    it('only reset leaves it', () => {
      expect(step(SUCCEEDED, { type: 'reset' })).toEqual(editing());
      for (const a of [{ type: 'submit' }, { type: 'edit' }, { type: 'failed', message: 'm' }] as SubmissionAction<F>[]) expect(step(SUCCEEDED, a)).toBe(SUCCEEDED);
    });
  });

  it('a full happy path and a full retry path', () => {
    let s: Submission<F> = editing();
    for (const a of [{ type: 'submit' }, { type: 'failed', message: 'x' }, { type: 'edit' }, { type: 'submit' }, { type: 'succeeded' }] as SubmissionAction<F>[]) s = step(s, a);
    expect(s.status).toBe('succeeded');
  });

  it('hasErrors', () => { expect(hasErrors({})).toBe(false); expect(hasErrors({ a: 'x' })).toBe(true); });
});
