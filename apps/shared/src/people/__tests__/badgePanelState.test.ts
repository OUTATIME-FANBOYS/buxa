import { describe, expect, it } from 'vitest';
import { badgePanelReducer, initialBadgePanelState, type BadgePanelState } from '../badgePanelState';

const PAYLOAD = 'bx1.abcdefghijklmnopqrstuv';

describe('badgePanelReducer', () => {
  it('an issued badge has no view open: the caller shows it next', () => {
    expect(badgePanelReducer(initialBadgePanelState(false), { type: 'issued' })).toEqual({
      active: true,
      view: { kind: 'closed' },
    });
  });

  it('a reissue closes the old view and leaves no code on screen until the new one is shown', () => {
    const shown = badgePanelReducer(initialBadgePanelState(true), { type: 'revealed', payload: PAYLOAD });
    const reissued = badgePanelReducer(shown, { type: 'issued' });

    expect(reissued).toEqual({ active: true, view: { kind: 'closed' } });
    expect(JSON.stringify(reissued)).not.toContain(PAYLOAD);
  });

  it('a shown badge holds the code and keeps the active flag', () => {
    expect(badgePanelReducer(initialBadgePanelState(true), { type: 'revealed', payload: PAYLOAD })).toEqual({
      active: true,
      view: { kind: 'shown', payload: PAYLOAD },
    });
  });

  it('revoke clears the code and the active flag', () => {
    const shown = badgePanelReducer(initialBadgePanelState(true), { type: 'revealed', payload: PAYLOAD });
    const revoked = badgePanelReducer(shown, { type: 'revoked' });

    expect(revoked).toEqual({ active: false, view: { kind: 'closed' } });
    expect(JSON.stringify(revoked)).not.toContain(PAYLOAD);
  });

  it('issue, show, close, revoke ends with no active badge and no code', () => {
    const states: BadgePanelState[] = [];
    let state = initialBadgePanelState(false);
    for (const event of [
      { type: 'issued' },
      { type: 'revealed', payload: PAYLOAD },
      { type: 'closed' },
      { type: 'revoked' },
    ] as const) {
      state = badgePanelReducer(state, event);
      states.push(state);
    }

    expect(states.map(s => s.view.kind)).toEqual(['closed', 'shown', 'closed', 'closed']);
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
