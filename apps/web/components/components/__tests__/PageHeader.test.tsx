import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageHeader } from '@/components/components';

describe('PageHeader', () => {
  it('renders the title alone when there is no subtitle or action', () => {
    expect(renderToStaticMarkup(<PageHeader title="On site" />)).toBe(
      '<header class="page-head"><div class="page-title"><h1>On site</h1></div></header>',
    );
  });
  it('adds the subtitle and the actions', () => {
    const html = renderToStaticMarkup(<PageHeader title="Check-in" subtitle="Scan." actions={<b>Go</b>} />);
    expect(html).toContain('<p class="muted">Scan.</p>');
    expect(html).toContain('<div class="page-actions"><b>Go</b></div>');
  });
});
