import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Household } from '@buxa/contracts';
import { HouseholdPanel, type HouseholdPanelProps } from '@/components/components/people';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/unlinkHouseholdAction', () => ({
  unlinkHouseholdAction: () => settle(() => ({ status: 'idle' })),
}));
vi.mock('@buxa/server/composers/people/linkHouseholdAction', () => ({
  linkHouseholdAction: () => settle(() => ({ status: 'idle' })),
}));
vi.mock('@/components/components/people/forms/PersonFinder', () => ({ PersonFinder: () => null }));

const household = { id: 'h-1', name: 'The Coles', members: [] } as unknown as Household;
const base: HouseholdPanelProps = {
  personId: 'p-1',
  households: [],
  householdOptions: [],
  canUpdate: false,
  canCreate: false,
  canAuthorisePickup: false,
  query: '',
  linkable: [],
};

describe('HouseholdPanel', () => {
  it('says the person is not in a household yet', () => {
    expect(renderToStaticMarkup(<HouseholdPanel {...base} />)).toContain('Not in a household yet.');
  });
  it('lists each household with a link to add a child to it when staff may create people', () => {
    const html = renderToStaticMarkup(<HouseholdPanel {...base} households={[household]} canCreate />);
    expect(html).toContain('<h3 class="people-subheading">The Coles</h3>');
    expect(html).toContain('Members of The Coles');
    expect(html).toContain('household=h-1');
  });
  it('offers the link form only to people who can update, when there is a household to link to', () => {
    expect(
      renderToStaticMarkup(
        <HouseholdPanel {...base} canUpdate householdOptions={[{ id: 'h-1', name: 'The Coles' }]} />,
      ),
    ).toContain('Link someone to a household');
    expect(
      renderToStaticMarkup(
        <HouseholdPanel {...base} canUpdate={false} householdOptions={[{ id: 'h-1', name: 'The Coles' }]} />,
      ),
    ).not.toContain('Link someone');
  });
});
