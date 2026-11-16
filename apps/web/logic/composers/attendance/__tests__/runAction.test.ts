import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Actor } from '@buxa/domain';
import { runAttendanceAction } from '../runAction';
import { badRequest, forbidden, tooManyRequests } from '../../../../server/http/errors';

const h = vi.hoisted(() => ({ campActor: vi.fn() }));
vi.mock('../campActor', () => ({ campActor: h.campActor }));

const ACTOR = { userId: 'u-1' } as unknown as Actor;
const schema = z.object({ n: z.number() });

describe('runAttendanceAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('answers invalid input with the first schema message, without looking up the camp', async () => {
    const call = vi.fn();
    const out = await runAttendanceAction(schema, { n: 'x' }, call);
    expect(out).toMatchObject({ kind: 'invalid' });
    expect(h.campActor).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });
  it('is forbidden when no camp is selected', async () => {
    h.campActor.mockResolvedValueOnce(null);
    expect(await runAttendanceAction(schema, { n: 1 }, vi.fn())).toEqual({ kind: 'forbidden', message: 'Choose a camp first.' });
  });
  it('returns the call result as ok with the parsed data', async () => {
    h.campActor.mockResolvedValueOnce(ACTOR);
    const call = vi.fn(async () => 'done');
    expect(await runAttendanceAction(schema, { n: 1 }, call)).toEqual({ kind: 'ok', value: 'done' });
    expect(call).toHaveBeenCalledWith(ACTOR, { n: 1 });
  });
  it('maps 403 to forbidden and 400 to invalid, with the service message', async () => {
    h.campActor.mockResolvedValue(ACTOR);
    expect(await runAttendanceAction(schema, { n: 1 }, async () => { throw forbidden('Not for you.'); })).toEqual({ kind: 'forbidden', message: 'Not for you.' });
    expect(await runAttendanceAction(schema, { n: 1 }, async () => { throw badRequest('Bad.'); })).toEqual({ kind: 'invalid', message: 'Bad.' });
  });
  it('maps 429 to invalid so the message can say when to try again', async () => {
    h.campActor.mockResolvedValueOnce(ACTOR);
    expect(await runAttendanceAction(schema, { n: 1 }, async () => { throw tooManyRequests(30, 'Slow down.'); })).toMatchObject({ kind: 'invalid', message: 'Slow down.' });
  });
  it('rethrows any other error', async () => {
    h.campActor.mockResolvedValueOnce(ACTOR);
    await expect(runAttendanceAction(schema, { n: 1 }, async () => { throw new Error('db down'); })).rejects.toThrow('db down');
  });
});
