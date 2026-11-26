import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PersonFinder } from '@/components/components/people/forms';

describe('PersonFinder', () => {
  it('is a bookmarkable GET search back on the page it is given, with the query kept', () => {
    const html = renderToStaticMarkup(<PersonFinder action="/camp/households/h-1" query="Jo" />);
    expect(html).toContain('role="search"');
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/camp/households/h-1"');
    expect(html).toContain('name="q" value="Jo"');
  });
});
