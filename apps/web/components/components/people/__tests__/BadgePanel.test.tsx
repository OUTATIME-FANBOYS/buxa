import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BadgePanel, type BadgePanelProps } from '@/components/components/people/export';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/issueBadgeAction', () => ({
  issueBadgeAction: () => settle(() => ({ status: 'idle' })),
}));
vi.mock('@buxa/server/composers/people/revokeBadgeAction', () => ({
  revokeBadgeAction: () => settle(() => ({ status: 'idle' })),
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
  it('explains that archived people cannot have a badge, and that only admins can manage one', () => {
    expect(renderToStaticMarkup(<BadgePanel {...base} archived />)).toContain('Archived people cannot have a badge.');
    expect(renderToStaticMarkup(<BadgePanel {...base} canManage={false} />)).toContain(
      'Only admins can issue or revoke badges.',
    );
  });
});
