import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PersonMembership } from '@buxa/contracts';
import { MembershipsPanel } from '@/components/components/people/export';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/addMembershipAction', () => ({
  addMembershipAction: () => settle(() => ({ status: 'idle' })),
}));
vi.mock('@buxa/server/composers/people/revokeMembershipAction', () => ({
  revokeMembershipAction: () => settle(() => ({ status: 'idle' })),
}));

const membership = {
  id: 'm-1',
  plan: 'Full season',
  startsOn: '2027-06-01',
  endsOn: '2027-08-31',
  status: 'valid',
  revokedAt: null,
  revokedReason: null,
} as unknown as PersonMembership;

describe('MembershipsPanel', () => {
  it('says a person with no membership cannot attend yet', () => {
    const html = renderToStaticMarkup(
      <MembershipsPanel personId="p-1" memberships={[]} canManage timeZone="Europe/London" clockFormat="24h" />,
    );
    expect(html).toContain('No membership yet. Attendance needs a valid membership.');
  });
  it('lists each membership, and offers to add one only to managers', () => {
    const manager = renderToStaticMarkup(
      <MembershipsPanel
        personId="p-1"
        memberships={[membership]}
        canManage
        timeZone="Europe/London"
        clockFormat="24h"
      />,
    );
    expect(manager).toContain('aria-label="Memberships"');
    expect(manager).toContain('Full season');
    expect(manager).toContain('Add a membership');
    const viewer = renderToStaticMarkup(
      <MembershipsPanel
        personId="p-1"
        memberships={[membership]}
        canManage={false}
        timeZone="Europe/London"
        clockFormat="24h"
      />,
    );
    expect(viewer).toContain('Full season');
    expect(viewer).not.toContain('Add a membership');
  });
});
