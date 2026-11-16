import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageHeader } from '../PageHeader';

describe('people PageHeader', () => {
  it('renders the title with its subtitle and actions', () => {
    const html = renderToStaticMarkup(<PageHeader title="People" subtitle="Everyone in camp" actions={<a href="/new">Add</a>} />);
    expect(html).toContain('<h1>People</h1>');
    expect(html).toContain('<p class="muted">Everyone in camp</p>');
    expect(html).toContain('<div class="page-actions"><a href="/new">Add</a></div>');
  });
});
