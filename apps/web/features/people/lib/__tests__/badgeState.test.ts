import { describe, expect, it } from 'vitest';
import type { BadgeState } from '../../../../logic/common';

describe('BadgeState', () => {
  it('is either an ordinary action state or the one issued moment with its payload', () => {
    const issued: BadgeState = { status: 'issued', payload: 'BUXA-1' };
    const idle: BadgeState = { status: 'idle' };
    expect(issued.status).toBe('issued');
    expect(idle.status).toBe('idle');
  });
});
