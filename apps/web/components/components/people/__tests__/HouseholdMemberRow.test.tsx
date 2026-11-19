import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HouseholdMember } from '@buxa/contracts';
import { HouseholdMemberRow } from '@/components/components/people';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/unlinkHouseholdAction', () => ({
  unlinkHouseholdAction: () => settle(() => ({ status: 'idle' })),
}));

const member = {
  personId: 'p-2',
  givenName: 'Jo',
  familyName: 'Cole',
  relationship: 'Mother',
  isGuardian: true,
  canPickup: true,
} as unknown as HouseholdMember;

describe('HouseholdMemberRow', () => {
  it('links the member to their record and states the two pick-up facts in words', () => {
    const html = renderToStaticMarkup(<HouseholdMemberRow member={member} householdId="h-1" canUpdate={false} />);
    expect(html).toContain('href="/camp/people/p-2"');
    expect(html).toContain('Jo Cole');
    expect(html).toContain('Guardian');
    expect(html).toContain('Can collect child');
    expect(html).not.toContain('Unlink');
  });
  it('shows no pick-up pills for someone who is neither guardian nor collector', () => {
    const html = renderToStaticMarkup(
      <HouseholdMemberRow
        member={{ ...member, isGuardian: false, canPickup: false }}
        householdId="h-1"
        canUpdate={false}
      />,
    );
    expect(html).not.toContain('Guardian');
    expect(html).not.toContain('Can collect');
  });
});
