import { describe, expect, it } from 'vitest';
import {
  ALL_SESSIONS,
  chosenSession,
  defaultSessionChoice,
  inChosenSession,
  sessionFilterOptions,
} from '../sessionFilter';

const sessions = [
  { id: 's-2', name: 'Winter', status: 'draft' as const },
  { id: 's-1', name: 'Summer', status: 'live' as const },
];

describe('sessionFilterOptions', () => {
  it('starts with All sessions, then each session by name', () => {
    expect(sessionFilterOptions(sessions)).toEqual([
      { value: '', label: 'All sessions' },
      { value: 's-1', label: 'Summer' },
      { value: 's-2', label: 'Winter' },
    ]);
  });
});

describe('defaultSessionChoice', () => {
  it('preselects the one live session', () => {
    expect(defaultSessionChoice(sessions)).toBe('s-1');
  });

  it('falls back to All sessions when two sessions are live', () => {
    expect(defaultSessionChoice([...sessions, { id: 's-3', name: 'Spring', status: 'live' }])).toBe(ALL_SESSIONS);
  });

  it('falls back to All sessions when none is live', () => {
    expect(defaultSessionChoice([{ id: 's-2', status: 'draft' }])).toBe(ALL_SESSIONS);
  });
});

describe('chosenSession', () => {
  it('takes the fallback when the URL names no session', () => {
    expect(chosenSession(undefined, sessions, 's-1')).toBe('s-1');
  });

  it('is All sessions for an empty parameter, even when a live session would be the default', () => {
    expect(chosenSession('', sessions, 's-1')).toBe(ALL_SESSIONS);
  });

  it('keeps a session the page knows', () => {
    expect(chosenSession('s-2', sessions, 's-1')).toBe('s-2');
  });

  it('is All sessions for an unknown id or a repeated parameter', () => {
    expect(chosenSession('nope', sessions)).toBe(ALL_SESSIONS);
    expect(chosenSession(['s-1', 's-2'], sessions)).toBe(ALL_SESSIONS);
  });
});

describe('inChosenSession', () => {
  it('shows every session under All sessions and only the chosen one otherwise', () => {
    expect(inChosenSession('s-1', ALL_SESSIONS)).toBe(true);
    expect(inChosenSession('s-1', 's-1')).toBe(true);
    expect(inChosenSession('s-2', 's-1')).toBe(false);
  });
});
