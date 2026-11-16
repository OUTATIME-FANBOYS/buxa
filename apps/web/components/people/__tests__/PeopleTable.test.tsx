import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PersonSummary } from '@buxa/contracts';
import { PeopleTable } from '../PeopleTable';

const person = { id: 'p-1', givenName: 'Ada', familyName: 'Lee', preferredName: 'Annie', roles: [], status: 'valid', onSite: true } as unknown as PersonSummary;

describe('PeopleTable', () => {
  it('links each person by name, with the preferred name in brackets', () => {
    const html = renderToStaticMarkup(<PeopleTable people={[person]} staffView={false} />);
    expect(html).toContain('href="/camp/people/p-1"');
    expect(html).toContain('Ada Lee (Annie)');
  });
  it('shows membership and on-site columns only to staff', () => {
    const staff = renderToStaticMarkup(<PeopleTable people={[person]} staffView />);
    expect(staff).toContain('<th scope="col">Membership</th>');
    expect(staff).toContain('>On site</span>');
    const viewer = renderToStaticMarkup(<PeopleTable people={[person]} staffView={false} />);
    expect(viewer).not.toContain('Membership');
    expect(viewer).not.toContain('On site');
  });
});
