export interface TokenInfo { exists: boolean; createdAt: string | null; lastSeen: string | null }

/**
 * Where "connect this agent to Claude" stands. One phase at a time, so the dialog can never show a token while
 * still loading, or offer to create a second token while one is being created.
 */
export type AgentConnection =
  | { phase: 'loading' }
  | { phase: 'unreachable' }
  | { phase: 'ready'; info: TokenInfo; error?: string }
  | { phase: 'issuing'; info: TokenInfo }
  | { phase: 'issued'; info: TokenInfo; token: string };

export type AgentConnectionEvent =
  | { type: 'loaded'; info: TokenInfo }
  | { type: 'loadFailed' }
  | { type: 'issueStarted' }
  | { type: 'issued'; token: string }
  | { type: 'issueFailed' }
  | { type: 'infoRefreshed'; info: TokenInfo }
  | { type: 'revoked'; info: TokenInfo };

export const initialConnection: AgentConnection = { phase: 'loading' };

export const ISSUE_FAILED = 'Could not create a token.';
export const UNREACHABLE = 'Could not reach the Buxa server.';

/** Events that do not fit the current phase are ignored. */
export function connectionReducer(s: AgentConnection, e: AgentConnectionEvent): AgentConnection {
  switch (e.type) {
    case 'loaded': return s.phase === 'loading' ? { phase: 'ready', info: e.info } : s;
    case 'loadFailed': return s.phase === 'loading' ? { phase: 'unreachable' } : s;
    case 'issueStarted': return s.phase === 'ready' ? { phase: 'issuing', info: s.info } : s;
    case 'issued': return s.phase === 'issuing' ? { phase: 'issued', info: { ...s.info, exists: true }, token: e.token } : s;
    case 'issueFailed': return s.phase === 'issuing' ? { phase: 'ready', info: s.info, error: ISSUE_FAILED } : s;
    case 'infoRefreshed': return s.phase === 'issued' ? { ...s, info: e.info } : s;
    case 'revoked': return s.phase === 'ready' ? { phase: 'ready', info: e.info } : s;
  }
}
