import { describe, expect, it } from 'vitest';
import { entryReducer, initialEntryState } from './entryFlow';

describe('the code steps at the gate and the desk', () => {
  it('moves from the email to the code step once a code is requested, whatever the answer says', () => {
    const asked = entryReducer(initialEntryState, { type: 'emailSubmitted' });
    expect(asked).toEqual({ step: 'email', busy: true, message: null });

    const next = entryReducer(asked, {
      type: 'codeRequested',
      email: 'ann@example.test',
      message: 'If that email is on file, a code is on its way.',
    });
    expect(next).toEqual({
      step: 'code',
      email: 'ann@example.test',
      busy: false,
      message: 'If that email is on file, a code is on its way.',
    });
  });

  it('keeps the email step and shows the message when the request is refused', () => {
    const failed = entryReducer(
      { step: 'email', busy: true, message: null },
      { type: 'requestFailed', message: 'Enter a valid email address.' },
    );
    expect(failed).toEqual({ step: 'email', busy: false, message: 'Enter a valid email address.' });
  });

  it('keeps the code step after a refused code, and verifies it once', () => {
    const code = { step: 'code' as const, email: 'ann@example.test', busy: true, message: null };
    const refused = entryReducer(code, { type: 'codeRefused', message: 'That code is not right.' });
    expect(refused).toEqual({
      step: 'code',
      email: 'ann@example.test',
      busy: false,
      message: 'That code is not right.',
    });
    expect(entryReducer(refused, { type: 'codeVerified' })).toEqual({ step: 'verified' });
  });

  it('goes back to the email step on request, and ignores events that do not fit the step', () => {
    const code = { step: 'code' as const, email: 'ann@example.test', busy: false, message: null };
    expect(entryReducer(code, { type: 'emailChanged' })).toEqual(initialEntryState);
    expect(entryReducer(initialEntryState, { type: 'codeVerified' })).toBe(initialEntryState);
    expect(entryReducer(initialEntryState, { type: 'codeSubmitted' })).toBe(initialEntryState);
  });
});
