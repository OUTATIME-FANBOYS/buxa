import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PersonMembership } from '@buxa/contracts';
import { MembershipRow } from '@/components/components/people/export';

vi.mock('@buxa/server/composers/people/revokeMembershipAction', () => ({ revokeMembershipAction: async () => ({ status: 'idle' }) }));

const membership = { id: 'm-1', plan: 'Full season', startsOn: '2027-06-01', endsOn: '2027-08-31', status: 'valid', revokedAt: null, revokedReason: null } as unknown as PersonMembership;

describe('MembershipRow', () => {
  it('shows the plan, the camp days and the status in words', () => {
    const html = renderToStaticMarkup(<MembershipRow membership={membership} personId="p-1" canManage={false} timeZone="Europe/London" clockFormat="24h" />);
    expect(html).toContain('<strong>Full season</strong>');
    expect(html).toContain('1 Jun 2027 to 31 Aug 2027');
    expect(html).toContain('Valid');
    expect(html).not.toContain('Revoke');
  });
  it('offers revoke behind a disclosure to managers, and says when a membership was revoked', () => {
    expect(renderToStaticMarkup(<MembershipRow membership={membership} personId="p-1" canManage timeZone="Europe/London" clockFormat="24h" />)).toContain('<summary');
    const revoked = { ...membership, status: 'revoked', revokedAt: '2027-07-01T10:00:00.000Z', revokedReason: 'Left camp' } as unknown as PersonMembership;
    const html = renderToStaticMarkup(<MembershipRow membership={revoked} personId="p-1" canManage timeZone="Europe/London" clockFormat="24h" />);
    expect(html).toContain('Revoked');
    expect(html).toContain('Left camp');
    expect(html).not.toContain('<summary');
  });
});
