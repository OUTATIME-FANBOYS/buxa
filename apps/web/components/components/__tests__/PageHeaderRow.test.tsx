import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageHeaderRow } from '@/components/components';

describe('PageHeaderRow', () => {
  it('renders the title block alone when there are no controls', () => {
    const html = renderToStaticMarkup(<PageHeaderRow title="On site" />);
    expect(html).toContain('<header class="page-head page-head-row">');
    expect(html).toContain('<div class="page-title"><h1>On site</h1></div>');
    expect(html).not.toContain('page-head-controls');
  });
  it('puts the subtitle in the title block and the controls after it', () => {
    const html = renderToStaticMarkup(<PageHeaderRow title="Holds" subtitle="Scan." controls={<b>Go</b>} />);
    expect(html).toContain('<p class="muted">Scan.</p>');
    expect(html).toContain('<div class="page-head-controls"><b>Go</b></div>');
    expect(html.indexOf('page-title')).toBeLessThan(html.indexOf('page-head-controls'));
  });
});
