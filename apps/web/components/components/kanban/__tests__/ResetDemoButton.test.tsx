import { Dialog as ConfirmDialog } from '@/components/components/export';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ResetDemoButton } from '@/components/components/kanban/export';

vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => ({ actions: { resetDemo: () => undefined } }) }));

describe('ResetDemoButton', () => {
  it('is a danger-styled button to reset the browser demo, which asks before it acts', () => {
    expect(renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}><ResetDemoButton /></UiProvider>)).toMatch(/<button[^>]*class="[^"]*button--danger-soft[^"]*"[^>]*>Reset demo data<\/button>/);
  });
});
