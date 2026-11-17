import { describe, expect, it } from 'vitest';
import { findScanActionId } from './actionId';

const ID = 'c0ffee'.repeat(7);

describe('findScanActionId', () => {
  it('finds the id named next to scanCodeAction in a bundle', () => {
    const bundle = `x=(0,r.createServerReference)("${ID}",r.callServer,void 0,r.findSourceMapURL,"scanCodeAction");`;
    expect(findScanActionId(bundle)).toBe(ID);
  });

  it('ignores the ids of other actions', () => {
    const other = 'd'.repeat(40);
    const bundle = `(0,a)("${other}",b,void 0,c,"checkInAction");(0,a)("${ID}",b,void 0,c,"scanCodeAction")`;
    expect(findScanActionId(bundle)).toBe(ID);
  });

  it('returns null when the action is not named, or the id is too short', () => {
    expect(findScanActionId('nothing to see here')).toBeNull();
    expect(findScanActionId('("abc123",b,"scanCodeAction")')).toBeNull();
  });
});
