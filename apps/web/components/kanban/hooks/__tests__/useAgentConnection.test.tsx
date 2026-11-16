// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '../../../UiProvider';
import { serverApi } from '@/logic/common';
import { useAgentConnection } from '../useAgentConnection';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useAgentConnection>;
let api: Api | undefined;
function Probe() { api = useAgentConnection('u-agent-triage', 'Triage Agent'); return null; }

describe('useAgentConnection', () => {
  let root: Root;
  beforeEach(() => {
    api = undefined;
    vi.spyOn(serverApi, 'tokenInfo').mockResolvedValue({ exists: false, createdAt: null, lastSeen: null });
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => root.render(<UiProvider><Probe /></UiProvider>));
  });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; vi.restoreAllMocks(); });

  it('loads the agent’s token status when it mounts', async () => {
    await act(async () => { await Promise.resolve(); });
    expect(serverApi.tokenInfo).toHaveBeenCalledWith('u-agent-triage');
    expect(api!.conn.phase).toBe('ready');
  });
  it('issues a token and shows it once', async () => {
    await act(async () => { await Promise.resolve(); });
    vi.spyOn(serverApi, 'issueToken').mockResolvedValueOnce({ token: 'tok-123' });
    await act(async () => { await api!.issue(); });
    expect(serverApi.issueToken).toHaveBeenCalledWith('u-agent-triage');
    expect(JSON.stringify(api!.conn)).toContain('tok-123');
  });
});
