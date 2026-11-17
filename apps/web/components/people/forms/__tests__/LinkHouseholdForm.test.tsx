import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LinkHouseholdForm } from '../LinkHouseholdForm';

vi.mock('@buxa/server/composers/people/linkHouseholdAction', () => ({ linkHouseholdAction: async () => ({ status: 'idle' }) }));

const households = [{ id: 'h-1', name: 'The Coles' }];
const people = [{ id: 'p-2', name: 'Jo Cole' }];

describe('LinkHouseholdForm', () => {
  it('lets staff pick a household, a matching person and how they are related', () => {
    const html = renderToStaticMarkup(<LinkHouseholdForm households={households} people={people} canAuthorisePickup={false} />);
    expect(html).toContain('<option value="h-1"');
    expect(html).toContain('>The Coles</option>');
    expect(html).toContain('>Jo Cole</option>');
    expect(html).toContain('How they are related');
    expect(html).toContain('>Link to household</button>');
  });
  it('offers the pick-up choice only to admins and above', () => {
    expect(renderToStaticMarkup(<LinkHouseholdForm households={households} people={people} canAuthorisePickup />)).toContain('May collect the child');
    expect(renderToStaticMarkup(<LinkHouseholdForm households={households} people={people} canAuthorisePickup={false} />)).not.toContain('May collect the child');
  });
});
