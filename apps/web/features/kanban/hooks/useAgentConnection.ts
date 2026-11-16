import { useEffect, useReducer } from 'react';
import { serverApi } from '../lib/sync';
import { connectionReducer, initialConnection } from '../state/agentConnection';
import { useUi } from '@/components/ui';

/** Talks to the local Buxa server about one agent's connection token and keeps the dialog's phase in step. */
export function useAgentConnection(agentId: string, name: string) {
  const { toast, confirm } = useUi();
  const [conn, dispatch] = useReducer(connectionReducer, initialConnection);
  useEffect(() => {
    serverApi.tokenInfo(agentId).then(info => dispatch({ type: 'loaded', info })).catch(() => dispatch({ type: 'loadFailed' }));
  }, [agentId]);

  const issue = async () => {
    if (conn.phase !== 'ready') return;
    if (conn.info.exists && !await confirm({ title: 'Replace the token?', body: `The current token for ${name} stops working straight away. Anything still using it will be disconnected.`, confirmLabel: 'Replace token', danger: true })) return;
    dispatch({ type: 'issueStarted' });
    try {
      const r = await serverApi.issueToken(agentId);
      dispatch({ type: 'issued', token: r.token });
      dispatch({ type: 'infoRefreshed', info: await serverApi.tokenInfo(agentId) });
    } catch { dispatch({ type: 'issueFailed' }); }
  };

  const revoke = async () => {
    if (!await confirm({ title: 'Disconnect this agent?', body: 'Its token stops working. You can create a new one at any time.', confirmLabel: 'Disconnect', danger: true })) return;
    await serverApi.revokeToken(agentId);
    dispatch({ type: 'revoked', info: await serverApi.tokenInfo(agentId) });
    toast('Disconnected');
  };
  return { conn, issue, revoke };
}
