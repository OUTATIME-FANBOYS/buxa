import { Dialog as ConfirmDialog } from '@/components/Dialog';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { SidebarToggle } from '../SidebarToggle';

describe('SidebarToggle', () => {
  it('is the mobile button that opens the navigation', () => {
    const html = renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}><SidebarToggle /></UiProvider>);
    expect(html).toContain('aria-label="Open navigation"');
    expect(html).toContain('only-mobile');
  });
});
