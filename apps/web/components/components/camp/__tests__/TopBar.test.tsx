import { Dialog as ConfirmDialog } from '@/components/components/export';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { TopBar } from '@/components/components/camp/export';

describe('TopBar', () => {
  it('puts the navigation toggle first, then the start and end content around the spacer', () => {
    const html = renderToStaticMarkup(
      <UiProvider Dialog={ConfirmDialog}>
        <TopBar start={<span>Camp</span>} end={<b>Me</b>} />
      </UiProvider>,
    );
    expect(html).toContain('<header class="topbar">');
    expect(html.indexOf('Open navigation')).toBeLessThan(html.indexOf('Camp'));
    expect(html.indexOf('Camp')).toBeLessThan(html.indexOf('<b>Me</b>'));
  });
});
