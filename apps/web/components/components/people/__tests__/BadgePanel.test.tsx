import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { BadgePanel, type BadgePanelProps } from '@/components/components/people';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/issueBadgeAction', () => ({
  issueBadgeAction: () => settle(() => ({ status: 'idle' })),
}));
vi.mock('@buxa/server/composers/people/revokeBadgeAction', () => ({
  revokeBadgeAction: () => settle(() => ({ status: 'idle' })),
}));
vi.mock('@buxa/server/composers/people/showBadgeAction', () => ({
  showBadgeAction: () => settle(() => ({ status: 'failed', message: 'unused' })),
  reprintBadgeAction: () => settle(() => ({ status: 'failed', message: 'unused' })),
}));

const base: BadgePanelProps = {
  personId: 'p-1',
  personName: 'Ada Lee',
  roleLabel: 'Camper',
  campName: 'Camp Birchwood',
  hasActiveBadge: false,
  archived: false,
  canManage: true,
};

/** The panel needs the toast provider, as the app's shell provides it. */
const panel = (props: BadgePanelProps) => (
  <UiProvider Dialog={() => null}>
    <BadgePanel {...props} />
  </UiProvider>
);

describe('BadgePanel', () => {
  it('says in words whether a badge is active', () => {
    expect(renderToStaticMarkup(panel({ ...base, hasActiveBadge: true }))).toContain('Badge active');
    expect(renderToStaticMarkup(panel(base))).toContain('No active badge');
  });
  it('with no active badge, says No badge yet and offers only Issue badge', () => {
    const html = renderToStaticMarkup(panel(base));
    expect(html).toContain('No badge yet.');
    expect(html).toContain('>Issue badge</button>');
    expect(html).not.toContain('Reprint');
    expect(html).not.toContain('Badge revoked.');
    expect(html).not.toContain('New badge');
  });
  it('lets a manager show, reissue and revoke an active badge, with no Reprint and no print outside the view', () => {
    const html = renderToStaticMarkup(panel({ ...base, hasActiveBadge: true }));
    expect(html).toContain('>Show badge</button>');
    expect(html).toContain('>Reissue</button>');
    expect(html).toContain('>Revoke</button>');
    expect(html).not.toContain('Reprint');
    expect(html).not.toContain('bx1.');
    expect(html).not.toContain('Print badge');
  });
  it('shows no Show or Reprint without an active badge, and none to a staff member', () => {
    expect(renderToStaticMarkup(panel(base))).not.toContain('Show badge');
    const staff = renderToStaticMarkup(panel({ ...base, hasActiveBadge: true, canManage: false }));
    expect(staff).not.toContain('Show badge');
    expect(staff).not.toContain('Reprint');
  });
  it('explains that archived people cannot have a badge, and that only admins can manage one', () => {
    expect(renderToStaticMarkup(panel({ ...base, archived: true }))).toContain('Archived people cannot have a badge.');
    expect(renderToStaticMarkup(panel({ ...base, canManage: false }))).toContain(
      'Only admins can issue or revoke badges.',
    );
  });
});
