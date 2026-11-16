import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '../../UiProvider';
import { SidebarToggle } from '../SidebarToggle';

describe('SidebarToggle', () => {
  it('is the mobile button that opens the navigation', () => {
    const html = renderToStaticMarkup(<UiProvider><SidebarToggle /></UiProvider>);
    expect(html).toContain('aria-label="Open navigation"');
    expect(html).toContain('only-mobile');
  });
});
