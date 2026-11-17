import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PeopleSearch } from '@/components/components/people/export';

describe('PeopleSearch', () => {
  it('is a bookmarkable GET search with the current name and role kept in the fields', () => {
    const html = renderToStaticMarkup(<PeopleSearch params={{ q: 'Lee', role: 'camper' }} />);
    expect(html).toContain('role="search"');
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/camp/people"');
    expect(html).toContain('name="q" value="Lee"');
    expect(html).toMatch(/<option value="camper" selected="">/);
    expect(html).toContain('<option value="">All roles</option>');
  });
});
