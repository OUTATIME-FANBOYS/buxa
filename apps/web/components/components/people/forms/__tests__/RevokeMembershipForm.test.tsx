import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RevokeMembershipForm } from '@/components/components/people/forms/export';

vi.mock('@buxa/server/composers/people/revokeMembershipAction', () => ({ revokeMembershipAction: async () => ({ status: 'idle' }) }));

describe('RevokeMembershipForm', () => {
  it('requires a reason and carries the membership and person ids', () => {
    const html = renderToStaticMarkup(<RevokeMembershipForm membershipId="m-1" personId="p-1" />);
    expect(html).toContain('Why is it being revoked? *');
    expect(html).toContain('Recorded with the revocation.');
    expect(html).toContain('name="membershipId" value="m-1"');
    expect(html).toContain('name="personId" value="p-1"');
    expect(html).toContain('>Revoke membership</button>');
  });
});
