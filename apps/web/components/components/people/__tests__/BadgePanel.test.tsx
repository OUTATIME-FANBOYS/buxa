import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
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

describe('BadgePanel', () => {
  it('says in words whether a badge is active', () => {
    expect(renderToStaticMarkup(<BadgePanel {...base} hasActiveBadge />)).toContain('Badge active');
    expect(renderToStaticMarkup(<BadgePanel {...base} />)).toContain('No active badge');
  });
  it('lets a manager issue or revoke badges', () => {
    expect(renderToStaticMarkup(<BadgePanel {...base} />)).not.toContain('Only admins');
  });
  it('lets a manager show, reprint and reissue an active badge', () => {
    const html = renderToStaticMarkup(<BadgePanel {...base} hasActiveBadge />);
    expect(html).toContain('Show badge');
    expect(html).toContain('Reprint badge');
    expect(html).toContain('Reissue badge');
    expect(html).not.toContain('bx1.');
  });
  it('shows no Show or Reprint without an active badge, and none to a staff member', () => {
    expect(renderToStaticMarkup(<BadgePanel {...base} />)).not.toContain('Show badge');
    const staff = renderToStaticMarkup(<BadgePanel {...base} hasActiveBadge canManage={false} />);
    expect(staff).not.toContain('Show badge');
    expect(staff).not.toContain('Reprint badge');
  });
  it('explains that archived people cannot have a badge, and that only admins can manage one', () => {
    expect(renderToStaticMarkup(<BadgePanel {...base} archived />)).toContain('Archived people cannot have a badge.');
    expect(renderToStaticMarkup(<BadgePanel {...base} canManage={false} />)).toContain(
      'Only admins can issue or revoke badges.',
    );
  });
});
