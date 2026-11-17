import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Membership } from '@buxa/contracts';
import { CampSwitcher } from '@/components/components/camp/export';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {} }) }));
vi.mock('@buxa/server/composers/camp/selectCampAction', () => ({ selectCampAction: async () => undefined }));

describe('CampSwitcher', () => {
  it('shows the current camp name in the crumb, and a menu labelled to switch camp', () => {
    const current = { orgId: 'o-1', name: 'Camp Birchwood' } as unknown as Membership;
    const html = renderToStaticMarkup(<CampSwitcher camps={[current]} current={current} />);
    expect(html).toContain('aria-label="Switch camp"');
    expect(html).toContain('<span class="crumb-text">Camp Birchwood</span>');
  });
  it('says there is no camp yet when the person has none', () => {
    expect(renderToStaticMarkup(<CampSwitcher camps={[]} current={null} />)).toContain('No camp yet');
  });
});
