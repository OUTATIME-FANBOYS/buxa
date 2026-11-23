import { describe, expect, it } from 'vitest';
import { badgePanelReducer, initialBadgePanelState, type BadgePanelState } from '../badgePanelState';

const PAYLOAD = 'bx1.abcdefghijklmnopqrstuv';

describe('badgePanelReducer', () => {
  it('a new badge is shown once, as fresh, and makes the person active', () => {
    const next = badgePanelReducer(initialBadgePanelState(false), { type: 'issued', payload: PAYLOAD });

    expect(next).toEqual({ active: true, view: { kind: 'shown', payload: PAYLOAD, fresh: true } });
  });

  it('a stored badge shown again is not fresh', () => {
    const active = initialBadgePanelState(true);
    expect(badgePanelReducer(active, { type: 'revealed', payload: PAYLOAD })).toEqual({
      active: true,
      view: { kind: 'shown', payload: PAYLOAD, fresh: false },
    });
  });

  it('revoke clears the revealed code and the active flag, so no code stays on screen', () => {
    const shown = badgePanelReducer(initialBadgePanelState(false), { type: 'issued', payload: PAYLOAD });
    const revoked = badgePanelReducer(shown, { type: 'revoked' });

    expect(revoked).toEqual({ active: false, view: { kind: 'closed' } });
    expect(JSON.stringify(revoked)).not.toContain(PAYLOAD);
  });

  it('issue, reveal, revoke ends with no active badge and no code', () => {
    const steps: BadgePanelState[] = [];
    let state = initialBadgePanelState(false);
    for (const event of [
      { type: 'issued', payload: PAYLOAD },
      { type: 'closed' },
      { type: 'revealed', payload: PAYLOAD },
      { type: 'revoked' },
    ] as const) {
      state = badgePanelReducer(state, event);
      steps.push(state);
    }

    expect(steps.map(s => s.view.kind)).toEqual(['shown', 'closed', 'shown', 'closed']);
    expect(state).toEqual({ active: false, view: { kind: 'closed' } });
  });

  it('a notice keeps the active flag and replaces any code', () => {
    const shown = badgePanelReducer(initialBadgePanelState(true), { type: 'revealed', payload: PAYLOAD });
    expect(badgePanelReducer(shown, { type: 'notice', message: 'Reissue to show the badge.' })).toEqual({
      active: true,
      view: { kind: 'notice', message: 'Reissue to show the badge.' },
    });
  });

  it('syncing to the page clears the code when the active state changes, and keeps it otherwise', () => {
    const shown = badgePanelReducer(initialBadgePanelState(true), { type: 'revealed', payload: PAYLOAD });

    expect(badgePanelReducer(shown, { type: 'synced', active: true })).toBe(shown);
    expect(badgePanelReducer(shown, { type: 'synced', active: false })).toEqual({
      active: false,
      view: { kind: 'closed' },
    });
  });
});
