import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Person } from '@buxa/contracts';
import { PersonHeader } from '@/components/components/people/export';

const person = { givenName: 'Ada', familyName: 'Lee', preferredName: null, roles: [], status: 'valid', onSite: false, archived: false } as unknown as Person;

describe('PersonHeader', () => {
  it('shows the name and the membership status in words', () => {
    const html = renderToStaticMarkup(<PersonHeader person={person} />);
    expect(html).toContain('<h1>Ada Lee</h1>');
    expect(html).toContain('Valid');
    expect(html).not.toContain('Archived');
  });
  it('says so when the person is archived, and shows on-site only when they are on site', () => {
    const html = renderToStaticMarkup(<PersonHeader person={{ ...person, archived: true, onSite: true } as unknown as Person} />);
    expect(html).toContain('Archived');
    expect(html).toContain('On site');
  });
});
