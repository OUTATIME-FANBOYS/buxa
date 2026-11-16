import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@/providers/providers';
import { ShellFrame } from '../ShellFrame';

vi.mock('next/navigation', () => ({ usePathname: () => '/camp' }));

describe('ShellFrame', () => {
  it('starts with the navigation closed and no scrim', () => {
    const html = renderToStaticMarkup(<UiProvider><ShellFrame sidebar={<nav>side</nav>} topBar={<header>top</header>}><p>main</p></ShellFrame></UiProvider>);
    expect(html).toContain('class="shell "');
    expect(html).not.toContain('nav-open');
    expect(html).not.toContain('nav-scrim');
    expect(html).toContain('<nav>side</nav>');
    expect(html).toContain('<p>main</p>');
  });
});
