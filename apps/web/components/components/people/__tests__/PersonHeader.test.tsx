import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Person } from '@buxa/contracts';
import { PersonHeader } from '@/components/components/people';

const person = {
  givenName: 'Ada',
  familyName: 'Lee',
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

  it('shows date of birth and phone on one muted line under the email, when the server sends them', () => {
    const html = renderToStaticMarkup(
      <PersonHeader
        person={{ ...person, email: 'ada@example.test', dateOfBirth: '2010-03-12', phone: '+1 555 0100' }}
      />,
    );
    expect(html).toContain('<p class="muted people-contact">Born 12 Mar 2010 · +1 555 0100</p>');
    expect(html.indexOf('ada@example.test')).toBeLessThan(html.indexOf('Born 12 Mar 2010'));
  });

  it('leaves out whichever contact value is empty, and no line when both are', () => {
    const onlyPhone = renderToStaticMarkup(
      <PersonHeader person={{ ...person, dateOfBirth: null, phone: '+1 555 0100' }} />,
    );
    expect(onlyPhone).toContain('<p class="muted people-contact">+1 555 0100</p>');
    expect(onlyPhone).not.toContain('Born');

    const onlyBorn = renderToStaticMarkup(
      <PersonHeader person={{ ...person, dateOfBirth: '2010-03-12', phone: '  ' }} />,
    );
    expect(onlyBorn).toContain('<p class="muted people-contact">Born 12 Mar 2010</p>');

    const neither = renderToStaticMarkup(<PersonHeader person={{ ...person, dateOfBirth: null, phone: null }} />);
    expect(neither).not.toContain('people-contact');
  });

  it('shows neither when the server withholds them (a role without contact access)', () => {
    const html = renderToStaticMarkup(
      <PersonHeader person={{ ...person, dateOfBirth: null, email: null, phone: null }} />,
    );
    expect(html).not.toContain('people-contact');
    expect(html).not.toContain('Born');
  });

  it('places the actions on the right of the name block', () => {
    const html = renderToStaticMarkup(<PersonHeader person={person} actions={<button type="button">Edit</button>} />);
    expect(html).toContain('<div class="page-actions"><button type="button">Edit</button></div>');
    expect(html.indexOf('<h1>')).toBeLessThan(html.indexOf('page-actions'));
  });
});
