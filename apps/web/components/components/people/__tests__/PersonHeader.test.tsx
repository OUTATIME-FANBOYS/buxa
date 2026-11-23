import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Person } from '@buxa/contracts';
import { PersonHeader } from '@/components/components/people';

const person = {
  givenName: 'Ada',
  familyName: 'Lee',
  preferredName: null,
  roles: [],
  status: 'valid',
  onSite: false,
  archived: false,
  email: null,
} as unknown as Person;

describe('PersonHeader', () => {
  it('shows the name and the membership status in words', () => {
    const html = renderToStaticMarkup(<PersonHeader person={person} />);
    expect(html).toContain('<h1>Ada Lee</h1>');
    expect(html).toContain('Valid');
    expect(html).not.toContain('Archived');
  });

  it('says so when the person is archived, and shows on-site only when they are on site', () => {
    const html = renderToStaticMarkup(<PersonHeader person={{ ...person, archived: true, onSite: true }} />);
    expect(html).toContain('Archived');
    expect(html).toContain('On site');
  });

  it('shows the email on its own muted line under the name, and nothing when there is none', () => {
    const html = renderToStaticMarkup(<PersonHeader person={{ ...person, email: 'ada@example.test' }} />);
    expect(html).toContain('<p class="muted people-email">ada@example.test</p>');
    expect(html.indexOf('<h1>')).toBeLessThan(html.indexOf('ada@example.test'));
    expect(renderToStaticMarkup(<PersonHeader person={person} />)).not.toContain('people-email');
  });

  it('places the actions on the right of the name block', () => {
    const html = renderToStaticMarkup(<PersonHeader person={person} actions={<button type="button">Edit</button>} />);
    expect(html).toContain('<div class="page-actions"><button type="button">Edit</button></div>');
    expect(html.indexOf('<h1>')).toBeLessThan(html.indexOf('page-actions'));
  });
});
