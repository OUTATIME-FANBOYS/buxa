import { Dialog as ConfirmDialog } from '@/components/components/export';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { WorkFrame } from '@/components/views/camp/export';

vi.mock('next/navigation', () => ({ usePathname: () => '/camp', useRouter: () => ({ push() {}, refresh() {} }) }));

describe('WorkFrame', () => {
  it('frames a work page with the navigation for the camp role and the page content', () => {
    const html = renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}><WorkFrame role="owner" topBarStart={<span>Camp</span>} topBarEnd={<b>me</b>}><p>Board</p></WorkFrame></UiProvider>);
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain('<p>Board</p>');
    expect(html).toContain('<span>Camp</span>');
  });
  it('still frames the page before the person has a camp', () => {
    expect(renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}><WorkFrame role={null}><p>Set up</p></WorkFrame></UiProvider>)).toContain('<p>Set up</p>');
  });
  it('says the camp is archived, above the page, when it is archived', () => {
    const html = renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}><WorkFrame role="owner" archived><p>Board</p></WorkFrame></UiProvider>);
    expect(html).toContain('This camp is archived');
    expect(html.indexOf('This camp is archived')).toBeLessThan(html.indexOf('<p>Board</p>'));
  });
  it('shows no archived banner for a live camp', () => {
    expect(renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}><WorkFrame role="owner"><p>Board</p></WorkFrame></UiProvider>)).not.toContain('This camp is archived');
  });
});
