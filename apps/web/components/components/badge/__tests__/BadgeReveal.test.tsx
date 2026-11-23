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
  it('offers Show badge and no Reprint, to anyone', () => {
    const html = renderToStaticMarkup(<BadgeReveal {...base} />);
    expect(html).toContain('Show badge');
    expect(html).not.toContain('Reprint');
  });

  it('renders no code before anyone presses Show: the payload never comes with the page', () => {
    const html = renderToStaticMarkup(<BadgeReveal {...base} />);
    expect(html).not.toContain('bx1.');
    expect(html).not.toContain('badge-card');
    expect(html).not.toContain('Print badge');
  });
});
