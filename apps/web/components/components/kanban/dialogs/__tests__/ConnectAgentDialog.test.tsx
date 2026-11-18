import { Dialog as ConfirmDialog } from '@/components/components/export';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ConnectAgentDialog } from '@/components/components/kanban/dialogs/export';
import { requirePresent } from '@buxa/domain';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/hooks/useAgentConnection', () => ({
  useAgentConnection: () => ({ conn: { phase: 'ready', info: { exists: false, createdAt: null, lastSeen: null } }, issue() {}, revoke() {} }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ConnectAgentDialog', () => {
  let root: Root;
  beforeEach(() => {
    h.store = { serverInfo: { mcpUrl: 'http://127.0.0.1:3100/mcp' } };
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount()); document.body.innerHTML = '';
  });

  it('opens as a dialog and says a new token is not connected yet', () => {
    act(() => root.render(<UiProvider Dialog={ConfirmDialog}><ConnectAgentDialog agentId="u-agent-triage" name="Triage Agent" onClose={() => undefined} /></UiProvider>));
    const dialog = requirePresent(document.querySelector('[role="dialog"]'), "document.querySelector('[role=\"dialog\"]')");
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Not connected yet');
  });
});
