import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PersonSummary } from '@buxa/contracts';
import { PeopleTable } from '@/components/components/people';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { Dialog as ConfirmDialog } from '@/components/components';

const withUi = (node: React.ReactElement) => <UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>;

const person = {
  id: 'p-1',
  givenName: 'Ada',
  familyName: 'Lee',
  roles: [],
  status: 'valid',
  onSite: true,
} as unknown as PersonSummary;

describe('PeopleTable', () => {
  it('links each person by first name and family name', () => {
    const html = renderToStaticMarkup(withUi(<PeopleTable people={[person]} staffView={false} />));
    expect(html).toContain('href="/camp/people/p-1"');
    expect(html).toContain('Ada Lee</a>');
  });
  it('shows membership and on-site columns only to staff', () => {
    const staff = renderToStaticMarkup(withUi(<PeopleTable people={[person]} staffView />));
    expect(staff).toContain('<th scope="col">Membership</th>');
    expect(staff).toContain('>On site</span>');
    const viewer = renderToStaticMarkup(withUi(<PeopleTable people={[person]} staffView={false} />));
    expect(viewer).not.toContain('Membership');
    expect(viewer).not.toContain('On site');
  });
});
