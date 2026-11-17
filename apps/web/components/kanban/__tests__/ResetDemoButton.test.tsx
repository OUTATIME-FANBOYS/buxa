import { Dialog as ConfirmDialog } from '@/components/Dialog';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { ResetDemoButton } from '../ResetDemoButton';

vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => ({ actions: { resetDemo: () => undefined } }) }));

describe('ResetDemoButton', () => {
  it('is a danger-styled button to reset the browser demo, which asks before it acts', () => {
    expect(renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}><ResetDemoButton /></UiProvider>)).toContain('<button class="btn btn-danger-ghost">Reset demo data</button>');
  });
});
