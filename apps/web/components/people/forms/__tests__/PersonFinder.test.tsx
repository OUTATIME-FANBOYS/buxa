import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PersonFinder } from '../PersonFinder';

describe('PersonFinder', () => {
  it('is a bookmarkable GET search back on the person’s page, with the query kept', () => {
    const html = renderToStaticMarkup(<PersonFinder personId="p-1" query="Jo" />);
    expect(html).toContain('role="search"');
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/camp/people/p-1"');
    expect(html).toContain('name="q" value="Jo"');
  });
});
