import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusPill } from '../StatusPill';

const col = (name: string, kind: 'open' | 'active' | 'done') => ({ id: name, name, kind });

describe('StatusPill', () => {
  it('shows the status emoji and name in a glass pill of the status colour', () => {
    const html = renderToStaticMarkup(<StatusPill column={col('In Progress', 'active')} />);
    expect(html).toMatch(/<span class="status-pill status-orange">/);
    expect(html).toContain('🔨');
    expect(html).toContain('In Progress</span>');
  });
  it('colours a column the owner named by its kind', () => {
    expect(renderToStaticMarkup(<StatusPill column={col('Waiting', 'open')} />)).toContain('status-blue');
    expect(renderToStaticMarkup(<StatusPill column={col('Shipped', 'done')} />)).toContain('status-green');
  });
  it('keeps the emoji out of the screen reader’s way: it is decorative, the name is read', () => {
    const html = renderToStaticMarkup(<StatusPill column={col('Done', 'done')} />);
    expect(html).toContain('<span aria-hidden="true">✅</span>');
  });
});
