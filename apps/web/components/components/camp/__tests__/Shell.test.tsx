import { Dialog as ConfirmDialog } from '@/components/components/export';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Shell } from '@/components/components/camp/export';

vi.mock('next/navigation', () => ({ usePathname: () => '/camp', useRouter: () => ({ push() {}, refresh() {} }) }));

const nav = [{ label: '', items: [{ href: '/camp', label: 'Home', icon: 'dashboard' }] }] as never;

describe('Shell', () => {
  it('frames the page with the skip link, the sidebar, the top bar and the page content', () => {
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <Shell nav={nav} brandHref="/camp" topBarStart={<span>Camp</span>} topBarEnd={<b>Me</b>}>
          <p>Page body</p>
        </Shell>
      </UiProvider>,
    );
    expect(html).toContain('Skip to content');
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain('class="topbar"');
    expect(html).toContain('<main id="main"');
    expect(html).toContain('<p>Page body</p>');
  });
});
