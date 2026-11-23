import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileBadges } from '@/components/components/badge';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/people/showBadgeAction', () => ({
  showBadgeAction: () => settle(() => ({ status: 'failed', message: 'unused' })),
  reprintBadgeAction: () => settle(() => ({ status: 'failed', message: 'unused' })),
}));

const self = { personId: 'me', name: 'Gina Lee', roleLabel: 'Guardian', hasActiveBadge: true, self: true };
const child = { personId: 'cal', name: 'Cal Lee', roleLabel: 'Participant', hasActiveBadge: true, self: false };
const childNoBadge = { personId: 'ada', name: 'Ada Lee', roleLabel: 'Participant', hasActiveBadge: false, self: false };

describe('ProfileBadges', () => {
  it('shows nothing with no camp or no person record', () => {
    expect(renderToStaticMarkup(<ProfileBadges badges={[]} campName="Camp Birchwood" />)).toBe('');
    expect(renderToStaticMarkup(<ProfileBadges badges={[self]} campName={null} />)).toBe('');
  });

  it("gives a guardian each child's badge with a Show button, under their own", () => {
    const html = renderToStaticMarkup(<ProfileBadges badges={[self, child]} campName="Camp Birchwood" />);
    expect(html).toContain('Your badge');
    expect(html).toContain('Cal Lee');
    expect(html.match(/Show badge/g)).toHaveLength(2);
  });

  it('shows "No badge yet" and no button for a person without a badge', () => {
    const html = renderToStaticMarkup(<ProfileBadges badges={[childNoBadge]} campName="Camp Birchwood" />);
    expect(html).toContain('No badge yet');
    expect(html).not.toContain('Show badge');
  });

  it('shows only the signed-in person when there are no children', () => {
    const html = renderToStaticMarkup(<ProfileBadges badges={[self]} campName="Camp Birchwood" />);
    expect(html.match(/Show badge/g)).toHaveLength(1);
    expect(html).not.toContain('Cal Lee');
  });
});
