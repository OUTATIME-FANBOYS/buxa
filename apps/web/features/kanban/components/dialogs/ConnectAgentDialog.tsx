import { Dialog, Field, useUi } from '@/components/ui';
import { useStore } from '../../state/store';
import { UNREACHABLE, type AgentConnection } from '../../state/agentConnection';
import { useAgentConnection } from '../../hooks/useAgentConnection';

function TokenReveal({ name, token, url }: { name: string; token: string; url: string }) {
  const { toast } = useUi();
  const cli = `claude mcp add --transport http buxa ${url} --header "Authorization: Bearer ${token}"`;
  const cfg = JSON.stringify({ mcpServers: { buxa: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast('Copy failed. Select the text and copy it by hand.', { tone: 'error' }); } };
  return (<>
    <p className="notice-box" role="status">Copy this now. It is shown once, and anyone who holds it can act as {name}. Treat it like a password.</p>
    <Field label="Claude Code (run in a terminal)"><div className="copy-box"><code>{cli}</code><button type="button" className="btn btn-sm" onClick={() => copy(cli, 'Command')}>Copy</button></div></Field>
    <Field label="Other MCP clients (JSON config)"><div className="copy-box"><pre>{cfg}</pre><button type="button" className="btn btn-sm" onClick={() => copy(cfg, 'Config')}>Copy</button></div></Field>
    <p className="muted small">The server only listens on this computer ({url}).</p>
  </>);
}

function TokenStatus({ conn }: { conn: AgentConnection }) {
  if (conn.phase !== 'ready' && conn.phase !== 'issuing') return null;
  const { info } = conn;
  return <p className="small"><strong>{info.exists ? 'A token exists' : 'Not connected yet'}</strong>{info.exists && info.createdAt && <span className="muted"> · created {new Date(info.createdAt).toLocaleDateString()}{info.lastSeen ? ` · last used ${new Date(info.lastSeen).toLocaleString()}` : ' · never used'}</span>}</p>;
}

/** Creates (or replaces) the token an agent uses to connect, and shows how to hand it to Claude. The token is shown once. */
export function ConnectAgentDialog({ agentId, name, onClose }: { agentId: string; name: string; onClose: () => void }) {
  const { serverInfo } = useStore();
  const { conn, issue, revoke } = useAgentConnection(agentId, name);
  const url = serverInfo.mcpUrl ?? `${location.origin}/mcp`;
  const error = conn.phase === 'unreachable' ? UNREACHABLE : conn.phase === 'ready' ? conn.error : undefined;
  const issued = conn.phase === 'issued';
  const hasToken = (conn.phase === 'ready' || conn.phase === 'issuing') && conn.info.exists;
  return (
    <Dialog title={`Connect ${name}`} onClose={onClose} wide>
      <div className="stack">
        <p className="muted">Give Claude (or any MCP client) this agent’s token. It can then read the projects you allowed and propose changes, always within the permissions you set here.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <TokenStatus conn={conn} />
        {conn.phase === 'issued' && <TokenReveal name={name} token={conn.token} url={url} />}
        <div className="row-end">
          {conn.phase === 'ready' && conn.info.exists && <button className="btn btn-danger-ghost" onClick={revoke}>Disconnect</button>}
          <button className="btn" onClick={onClose}>{issued ? 'Done' : 'Close'}</button>
          {!issued && <button className="btn btn-primary" onClick={issue} disabled={conn.phase !== 'ready'}>{hasToken ? 'Replace token' : 'Create token'}</button>}
        </div>
      </div>
    </Dialog>
  );
}
