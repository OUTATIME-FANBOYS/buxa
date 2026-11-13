import { describe, expect, it } from 'vitest';
import { authFormReducer, initialAuthForm, validateAuth, type AuthForm, type AuthFormEvent } from './authForm';

const run = (from: AuthForm, ...events: AuthFormEvent[]) => events.reduce(authFormReducer, from);

describe('auth form phases', () => {
  it('submits, then returns to editing with the failure message', () => {
    const s = run(initialAuthForm, { type: 'submitStarted' });
    expect(s).toEqual({ phase: 'submitting', mode: 'in' });
    expect(run(s, { type: 'finished', message: 'That password is not correct.' })).toEqual({ phase: 'editing', mode: 'in', errors: { form: 'That password is not correct.' } });
    expect(run(s, { type: 'finished', message: null })).toEqual(initialAuthForm);
  });

  it('cannot submit twice or switch mode while submitting', () => {
    const s = run(initialAuthForm, { type: 'submitStarted' });
    expect(run(s, { type: 'submitStarted' })).toBe(s);
    expect(run(s, { type: 'switchMode' })).toBe(s);
    expect(run(s, { type: 'invalid', errors: { pw: 'x' } })).toBe(s);
  });

  it('switching mode clears messages', () => {
    const s = run(initialAuthForm, { type: 'invalid', errors: { email: 'bad' } }, { type: 'switchMode' });
    expect(s).toEqual({ phase: 'editing', mode: 'up', errors: {} });
  });

  it('ignores a finish nobody asked for', () => {
    expect(run(initialAuthForm, { type: 'finished', message: 'x' })).toBe(initialAuthForm);
  });

  it('validates per mode', () => {
    expect(validateAuth('in', '', 'a@b.co', 'x')).toEqual({});
    expect(validateAuth('in', '', 'nope', '')).toEqual({ email: 'Enter a valid email address.', pw: 'Enter your password.' });
    expect(validateAuth('up', ' ', 'a@b.co', 'short')).toEqual({ name: 'Tell us what to call you.', pw: 'Use at least 8 characters.' });
  });
});
