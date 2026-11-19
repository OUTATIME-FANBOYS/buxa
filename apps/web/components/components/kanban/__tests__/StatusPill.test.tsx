import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusPill } from '../StatusPill';

const col = (name: string, kind: 'open' | 'active' | 'done') => ({ id: name, name, kind });

describe('StatusPill', () => {
  it('shows the status line icon and name in a glass pill of the status colour, with no emoji', () => {
    const html = renderToStaticMarkup(<StatusPill column={col('In Progress', 'active')} />);
    expect(html).toMatch(/<span class="status-pill status-orange">/);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toContain('In Progress</span>');
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it('colours a column the owner named by its kind', () => {
    expect(renderToStaticMarkup(<StatusPill column={col('Waiting', 'open')} />)).toContain('status-blue');
    expect(renderToStaticMarkup(<StatusPill column={col('Shipped', 'done')} />)).toContain('status-green');
  });
});
