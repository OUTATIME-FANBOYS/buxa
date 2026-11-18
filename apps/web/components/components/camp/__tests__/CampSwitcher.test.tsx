import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { Membership } from '@buxa/contracts';
import { CampSwitcher } from '@/components/components/camp/export';
import { settle } from '@buxa/domain';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {} }) }));
vi.mock('@buxa/server/composers/camp/selectCampAction', () => ({ selectCampAction: () => settle(() => undefined) }));

describe('CampSwitcher', () => {
  it('shows the current camp name in the crumb, and a menu labelled to switch camp', () => {
    const current = { orgId: 'o-1', name: 'Camp Birchwood' } as unknown as Membership;
    const html = renderToStaticMarkup(<CampSwitcher camps={[current]} current={current} />);
    expect(html).toContain('aria-label="Switch camp"');
    expect(html).toContain('<span class="crumb-text" title="Camp Birchwood">Camp Birchwood</span>');
  });
  it('the trigger shows the full camp name, not an icon-sized square, and keeps the name for a truncated view', () => {
    const current = { orgId: 'o-2', name: 'Camp Birchwood Riverside Outdoor Centre' } as unknown as Membership;
    const html = renderToStaticMarkup(<CampSwitcher camps={[current]} current={current} />);
    expect(html).toMatch(/<button[^>]*class="[^"]*\bcamp-switch\b[^"]*"[^>]*aria-label="Switch camp"/);
    expect(html).toContain('>Camp Birchwood Riverside Outdoor Centre</span>');
    // Prettier breaks rules over several lines and uses single quotes, so the text is flattened before matching.
    const css = readFileSync(new URL('../../../../styles/features/camp.css', import.meta.url), 'utf8')
      .replace(/\s+/g, ' ')
      .replace(/['"]/g, '');
    expect(css).toContain('.crumb.camp-switch { width: auto;');
  });
  it('says there is no camp yet when the person has none', () => {
    expect(renderToStaticMarkup(<CampSwitcher camps={[]} current={null} />)).toContain('No camp yet');
  });
});
