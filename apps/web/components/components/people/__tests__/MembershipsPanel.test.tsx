import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PersonMembership } from '@buxa/contracts';
import { MembershipsPanel } from '@/components/components/people';
import { settle } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';

vi.mock('@buxa/server/composers/people/addMembershipAction', () => ({
  addMembershipAction: () => settle(() => ({ status: 'idle' })),
}));
vi.mock('@buxa/server/composers/people/revokeMembershipAction', () => ({
  revokeMembershipAction: () => settle(() => ({ status: 'idle' })),
}));

const NoDialog = () => null;

const membership = {
  id: 'm-1',
  plan: 'Full season',
  startsOn: '2027-06-01',
  endsOn: '2027-08-31',
  status: 'valid',
  revokedAt: null,
  revokedReason: null,
} as unknown as PersonMembership;

const render = (props: { memberships: PersonMembership[]; canManage: boolean }) =>
  renderToStaticMarkup(
    <UiProvider Dialog={NoDialog}>
      <MembershipsPanel
        personId="p-1"
        memberships={props.memberships}
        canManage={props.canManage}
        sessions={[]}
        timeZone="Europe/London"
        clockFormat="24h"
      />
    </UiProvider>,
  );

describe('MembershipsPanel', () => {
  it('says a person with no membership cannot attend yet', () => {
    expect(render({ memberships: [], canManage: true })).toContain(
      'No membership yet. Attendance needs a valid membership.',
    );
  });

  it('lists each membership, and offers an Add membership button only to managers', () => {
    const manager = render({ memberships: [membership], canManage: true });
    expect(manager).toContain('aria-label="Memberships"');
    expect(manager).toContain('Full season');
    const addButton = /<button[^>]*>(?:(?!<\/button>)[\s\S])*Add membership<\/button>/.exec(manager)?.[0] ?? '';
    expect(addButton).not.toBe('');
    expect(addButton).not.toContain('button--primary');
    expect(manager).not.toContain('Starts on');

    const viewer = render({ memberships: [membership], canManage: false });
    expect(viewer).toContain('Full season');
    expect(viewer).not.toContain('Add membership');
  });
});
