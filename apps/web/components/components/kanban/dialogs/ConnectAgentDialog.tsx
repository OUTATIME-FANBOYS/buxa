'use client';

import { Dialog } from '@/components/components';
import { Field, Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';
import { useStore } from '@buxa/middleware/providers/providers';
import { UNREACHABLE, type AgentConnection } from '@buxa/shared';
import { useAgentConnection } from '@buxa/middleware/hooks/hooks';

function TokenReveal({ name, token, url }: { name: string; token: string; url: string }) {
  const { toast } = useUi();
  const cli = `claude mcp add --transport http buxa ${url} --header "Authorization: Bearer ${token}"`;
  const cfg = JSON.stringify(
    { mcpServers: { buxa: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  );
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      toast('Copy failed. Select the text and copy it by hand.', { tone: 'error' });
    }
  };

  return (
    <>
      <p className="notice-box" role="status">
        Copy this now. It is shown once, and anyone who holds it can act as {name}. Treat it like a password.
      </p>
      <Field label="Claude Code (run in a terminal)">
        <div className="copy-box">
          <code>{cli}</code>
          <Button size="sm" type="button" onClick={() => void copy(cli, 'Command')}>
            Copy
          </Button>
        </div>
      </Field>
      <Field label="Other MCP clients (JSON config)">
        <div className="copy-box">
          <pre>{cfg}</pre>
          <Button size="sm" type="button" onClick={() => void copy(cfg, 'Config')}>
            Copy
          </Button>
        </div>
      </Field>
      <p className="muted small">The server only listens on this computer ({url}).</p>
    </>
  );
}

function TokenStatus({ conn }: { conn: AgentConnection }) {
  if (conn.phase !== 'ready' && conn.phase !== 'issuing') {
    return null;
  }
  const { info } = conn;

  return (
    <p className="small">
      <strong>{info.exists ? 'A token exists' : 'Not connected yet'}</strong>
      {info.exists && info.createdAt && (
        <span className="muted">
          {' '}
          · created {new Date(info.createdAt).toLocaleDateString()}
          {info.lastSeen ? ` · last used ${new Date(info.lastSeen).toLocaleString()}` : ' · never used'}
        </span>
      )}
    </p>
  );
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
        <p className="muted">
          Give Claude (or any MCP client) this agent’s token. It can then read the projects you allowed and propose
          changes, always within the permissions you set here.
        </p>
        {error && (
          <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
            {error}
          </p>
        )}
        <TokenStatus conn={conn} />
        {conn.phase === 'issued' && <TokenReveal name={name} token={conn.token} url={url} />}
        <div className="row-end">
          {conn.phase === 'ready' && conn.info.exists && (
            <Button variant="danger-soft" onClick={() => void revoke()}>
              Disconnect
            </Button>
          )}
          <Button onClick={onClose}>{issued ? 'Done' : 'Close'}</Button>
          {!issued && (
            <Button variant="primary" onClick={() => void issue()} disabled={conn.phase !== 'ready'}>
              {hasToken ? 'Replace token' : 'Create token'}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
