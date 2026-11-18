import { describe, expect, it } from 'vitest';
import { attempt } from './outcome';
import { ClassNotFoundError, InstructorNotFoundError, OverlapError } from './errors';

describe('attempt: expected errors become outcomes, anything else is rethrown', () => {
  it('returns the value when the work succeeds', async () => {
    expect(await attempt(async () => 42, 'Australia/Sydney')).toEqual({ ok: true, value: 42 });
  });

  it.each([
    [() => new ClassNotFoundError(), 'class_not_found'],
    [() => new InstructorNotFoundError(), 'instructor_not_found'],
  ])('maps a not-found error to its reason (%#)', async (make, reason) => {
    const outcome = await attempt(async () => {
      throw make();
    }, 'Australia/Sydney');
    expect(outcome).toMatchObject({ ok: false, failure: { reason } });
  });

  it('describes an overlap in the camp zone and keeps the refusal', async () => {
    const refusal = { kind: 'refuse' as const, reason: 'overlap' as const, clash: {
      sessionId: 's2', className: 'Painting', startsAt: '2027-07-05T01:00:00.000Z', endsAt: '2027-07-05T03:00:00.000Z',
    } };
    const outcome = await attempt(async () => {
      throw new OverlapError(refusal);
    }, 'Australia/Sydney');
    expect(outcome).toMatchObject({ ok: false, failure: { reason: 'overlap', refusal } });
    expect(outcome.ok === false && outcome.failure.message).toContain('Painting');
  });

  it('rethrows an unexpected error', async () => {
    await expect(attempt(async () => {
      throw new Error('connection lost');
    }, 'Australia/Sydney')).rejects.toThrow('connection lost');
  });
});
