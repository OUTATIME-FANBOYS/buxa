import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Household } from '@buxa/contracts';
import { HouseholdPanel, type HouseholdPanelProps } from '@/components/components/people';

const PERSON = 'p-1';
const member = (over: Partial<Household['members'][number]>) => ({
  personId: PERSON,
  givenName: 'Ben',
  familyName: 'Cole',
  roles: ['camper'] as Household['members'][number]['roles'],
  relationship: 'Son',
  isGuardian: false,
  canPickup: false,
  ...over,
});
const household = (over: Partial<Household> = {}): Household => ({
  id: 'h-1',
  name: 'The Coles',
  members: [
    member({}),
    member({
      personId: 'p-2',
      givenName: 'Ana',
      roles: ['guardian'],
      relationship: 'Mother',
      isGuardian: true,
      canPickup: true,
    }),
  ],
  ...over,
});

const base: HouseholdPanelProps = { personId: PERSON, households: [] };

describe('HouseholdPanel (person page card, links only)', () => {
  it('says the person is not in a household yet, with a link to the Households tab', () => {
    const html = renderToStaticMarkup(<HouseholdPanel {...base} />);
    expect(html).toContain('Not in a household yet.');
    expect(html).toContain('href="/camp/people?tab=households"');
    expect(html).toContain('Open the Households tab');
  });

  it('names the household, the role this person has in it, and links to the household page', () => {
    const html = renderToStaticMarkup(<HouseholdPanel {...base} households={[household()]} />);
    expect(html).toContain('The Coles');
    expect(html).toContain('Child');
    expect(html).toContain('href="/camp/households/h-1"');
    expect(html).toContain('Open household');
  });

  it('shows the Can collect child tag only where this person has it', () => {
    const child = renderToStaticMarkup(<HouseholdPanel {...base} households={[household()]} />);
    expect(child).not.toContain('Can collect child');

    const guardian = renderToStaticMarkup(<HouseholdPanel personId="p-2" households={[household()]} />);
    expect(guardian).toContain('Guardian');
    expect(guardian).toContain('Can collect child');
  });

  it('has no edit controls: no remove, add a child, link or pick-up', () => {
    const html = renderToStaticMarkup(<HouseholdPanel {...base} households={[household()]} />);
    expect(html).not.toContain('Remove');
    expect(html).not.toContain('Add a child to this household');
    expect(html).not.toContain('Link someone');
    expect(html).not.toContain('Find someone by name');
    expect(html).not.toContain('May collect the child');
    expect(html).not.toContain('<form');
  });
});
