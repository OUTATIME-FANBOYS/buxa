import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BadgeActions } from '@/components/components/people/forms';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/issueBadgeAction', () => ({
  issueBadgeAction: () => settle(() => ({ status: 'idle' })),
}));
vi.mock('@buxa/server/composers/people/revokeBadgeAction', () => ({
  revokeBadgeAction: () => settle(() => ({ status: 'idle' })),
}));

const base = { personId: 'p-1', personName: 'Ada Lee', roleLabel: 'Camper', campName: 'Camp Birchwood' };

describe('BadgeActions', () => {
  it('offers to issue a first badge, with no revoke until there is one', () => {
    const html = renderToStaticMarkup(<BadgeActions {...base} hasActiveBadge={false} />);
    expect(html).toContain('>Issue badge</button>');
    expect(html).not.toContain('Revoke badge');
  });
  it('offers to reissue and revoke when there is an active badge, and warns the old code stops', () => {
    const html = renderToStaticMarkup(<BadgeActions {...base} hasActiveBadge />);
    expect(html).toContain('>Reissue badge</button>');
    expect(html).toContain('>Revoke badge</button>');
    expect(html).toContain('The old code stops working at once.');
  });
});
