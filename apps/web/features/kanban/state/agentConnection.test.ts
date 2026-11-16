import { describe, expect, it } from 'vitest';
import { connectionReducer, initialConnection, ISSUE_FAILED, type AgentConnection, type AgentConnectionEvent, type TokenInfo } from './agentConnection';

const none: TokenInfo = { exists: false, createdAt: null, lastSeen: null };
const some: TokenInfo = { exists: true, createdAt: '2026-01-01T00:00:00Z', lastSeen: null };
const run = (from: AgentConnection, ...events: AgentConnectionEvent[]) => events.reduce(connectionReducer, from);

describe('agent connection phases', () => {
  it('loads, issues a token and shows it once', () => {
    const s = run(initialConnection, { type: 'loaded', info: none }, { type: 'issueStarted' }, { type: 'issued', token: 'tok' });
    expect(s).toEqual({ phase: 'issued', info: { ...none, exists: true }, token: 'tok' });
    expect(run(s, { type: 'infoRefreshed', info: some })).toEqual({ phase: 'issued', info: some, token: 'tok' });
  });

  it('reports an unreachable server only while loading', () => {
    expect(run(initialConnection, { type: 'loadFailed' })).toEqual({ phase: 'unreachable' });
    const ready = run(initialConnection, { type: 'loaded', info: none });
    expect(run(ready, { type: 'loadFailed' })).toBe(ready);
  });

  it('returns to ready with an error when issuing fails, keeping what we knew', () => {
    const s = run(initialConnection, { type: 'loaded', info: some }, { type: 'issueStarted' }, { type: 'issueFailed' });
    expect(s).toEqual({ phase: 'ready', info: some, error: ISSUE_FAILED });
  });

  it('cannot start a second issue while one is running, or before loading', () => {
    expect(run(initialConnection, { type: 'issueStarted' })).toBe(initialConnection);
    const issuing = run(initialConnection, { type: 'loaded', info: none }, { type: 'issueStarted' });
    expect(run(issuing, { type: 'issueStarted' })).toBe(issuing);
  });

  it('drops the token when disconnecting', () => {
    const ready = run(initialConnection, { type: 'loaded', info: some });
    expect(run(ready, { type: 'revoked', info: none })).toEqual({ phase: 'ready', info: none });
  });

  it('ignores a token that arrives when nothing was requested', () => {
    expect(run(initialConnection, { type: 'issued', token: 'x' })).toBe(initialConnection);
  });
});
