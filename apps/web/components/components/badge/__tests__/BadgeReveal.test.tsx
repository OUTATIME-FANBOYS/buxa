import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BadgeReveal } from '@/components/components/badge';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/showBadgeAction', () => ({
  showBadgeAction: () => settle(() => ({ status: 'failed', message: 'unused' })),
  reprintBadgeAction: () => settle(() => ({ status: 'failed', message: 'unused' })),
}));

const base = { personId: 'p-1', personName: 'Cal Lee', roleLabel: 'Participant', campName: 'Camp Birchwood' };

describe('BadgeReveal', () => {
  it('offers Show badge, and Reprint only to a manager', () => {
    const plain = renderToStaticMarkup(<BadgeReveal {...base} />);
    expect(plain).toContain('Show badge');
    expect(plain).not.toContain('Reprint badge');

    expect(renderToStaticMarkup(<BadgeReveal {...base} canReprint />)).toContain('Reprint badge');
  });

  it('renders no code before anyone presses Show: the payload never comes with the page', () => {
    const html = renderToStaticMarkup(<BadgeReveal {...base} canReprint />);
    expect(html).not.toContain('bx1.');
    expect(html).not.toContain('badge-card');
  });
});
