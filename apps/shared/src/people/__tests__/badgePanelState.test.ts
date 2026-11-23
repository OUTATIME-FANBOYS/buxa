import { describe, expect, it } from 'vitest';
import { badgePanelReducer, initialBadgePanelState, type BadgePanelState } from '../badgePanelState';

const PAYLOAD = 'bx1.abcdefghijklmnopqrstuv';

describe('badgePanelReducer', () => {
  it('a new badge is issued with a confirmation and no code on screen', () => {
    const next = badgePanelReducer(initialBadgePanelState(false), { type: 'issued', replaced: false });

    expect(next).toEqual({ active: true, view: { kind: 'done', message: 'Badge issued.' } });
  });

  it('a reissue replaces the badge, says so, and shows no code', () => {
    const shown = badgePanelReducer(initialBadgePanelState(true), { type: 'revealed', payload: PAYLOAD });
    const reissued = badgePanelReducer(shown, { type: 'issued', replaced: true });

    expect(reissued).toEqual({ active: true, view: { kind: 'done', message: 'Badge reissued.' } });
    expect(JSON.stringify(reissued)).not.toContain(PAYLOAD);
  });

  it('a stored badge shown again holds the code and keeps the active flag', () => {
    expect(badgePanelReducer(initialBadgePanelState(true), { type: 'revealed', payload: PAYLOAD })).toEqual({
      active: true,
      view: { kind: 'shown', payload: PAYLOAD },
    });
  });

  it('revoke clears the revealed code and the active flag, and confirms it', () => {
    const shown = badgePanelReducer(initialBadgePanelState(true), { type: 'revealed', payload: PAYLOAD });
    const revoked = badgePanelReducer(shown, { type: 'revoked' });

    expect(revoked).toEqual({ active: false, view: { kind: 'done', message: 'Badge revoked.' } });
    expect(JSON.stringify(revoked)).not.toContain(PAYLOAD);
  });

  it('issue, show, close, revoke ends with no active badge and no code', () => {
    const states: BadgePanelState[] = [];
    let state = initialBadgePanelState(false);
    for (const event of [
      { type: 'issued', replaced: false },
      { type: 'revealed', payload: PAYLOAD },
      { type: 'closed' },
      { type: 'revoked' },
    ] as const) {
      state = badgePanelReducer(state, event);
      states.push(state);
    }

    expect(states.map(s => s.view.kind)).toEqual(['done', 'shown', 'closed', 'done']);
    expect(state).toEqual({ active: false, view: { kind: 'done', message: 'Badge revoked.' } });
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
