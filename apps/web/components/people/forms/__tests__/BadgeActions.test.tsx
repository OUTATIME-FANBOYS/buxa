import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BadgeActions } from '../BadgeActions';

vi.mock('@/logic/composers/people/issueBadgeAction', () => ({ issueBadgeAction: async () => ({ status: 'idle' }) }));
vi.mock('@/logic/composers/people/revokeBadgeAction', () => ({ revokeBadgeAction: async () => ({ status: 'idle' }) }));

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
