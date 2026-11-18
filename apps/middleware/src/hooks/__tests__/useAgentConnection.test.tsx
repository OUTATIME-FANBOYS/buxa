import { StubDialog } from '../../providers/__tests__/stubDialog';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '../../providers/UiProvider';
import { serverApi } from '@buxa/shared';
import { useAgentConnection } from '../useAgentConnection';
import { requirePresent } from '@buxa/domain';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useAgentConnection>;
let api: Api | undefined;

function Probe() {
  api = useAgentConnection('u-agent-triage', 'Triage Agent');

  return null;
}

describe('useAgentConnection', () => {
  let root: Root;
  let tokenInfo: MockInstance;
  beforeEach(() => {
    api = undefined;
    tokenInfo = vi.spyOn(serverApi, 'tokenInfo').mockResolvedValue({ exists: false, createdAt: null, lastSeen: null });
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() =>
      root.render(
        <UiProvider Dialog={StubDialog}>
          <Probe />
        </UiProvider>,
      ),
    );
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('loads the agent’s token status when it mounts', async () => {
    await act(async () => {
      await Promise.resolve();
    });
    expect(tokenInfo).toHaveBeenCalledWith('u-agent-triage');
    expect(requirePresent(api, 'api').conn.phase).toBe('ready');
  });
  it('issues a token and shows it once', async () => {
    await act(async () => {
      await Promise.resolve();
    });
    const issueToken = vi.spyOn(serverApi, 'issueToken').mockResolvedValueOnce({ token: 'tok-123' });
    await act(async () => {
      await requirePresent(api, 'api').issue();
    });
    expect(issueToken).toHaveBeenCalledWith('u-agent-triage');
    expect(JSON.stringify(requirePresent(api, 'api').conn)).toContain('tok-123');
  });
});
