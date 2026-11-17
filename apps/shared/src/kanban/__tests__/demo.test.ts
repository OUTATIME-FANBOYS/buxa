import { describe, expect, it } from 'vitest';
import { buildDemo } from '../demo';

describe('buildDemo', () => {
  it('builds the demo camp with agent history and no signed-in user', () => {
    const state = buildDemo();
    expect(state.session.userId).toBeNull();
    expect(state.runs.length).toBeGreaterThan(0);
    expect(state.proposals.length).toBeGreaterThan(0);
  });
});
