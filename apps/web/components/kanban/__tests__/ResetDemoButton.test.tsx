import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '../../UiProvider';
import { ResetDemoButton } from '../ResetDemoButton';

vi.mock('@/components/kanban/state/store', () => ({ useStore: () => ({ actions: { resetDemo: () => undefined } }) }));

describe('ResetDemoButton', () => {
  it('is a danger-styled button to reset the browser demo, which asks before it acts', () => {
    expect(renderToStaticMarkup(<UiProvider><ResetDemoButton /></UiProvider>)).toContain('<button class="btn btn-danger-ghost">Reset demo data</button>');
  });
});
