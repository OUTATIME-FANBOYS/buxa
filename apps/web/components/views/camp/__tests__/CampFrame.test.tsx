import { Dialog as ConfirmDialog } from '@/components/components';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { CampFrame } from '../CampFrame';

vi.mock('next/navigation', () => ({ usePathname: () => '/camp', useRouter: () => ({ push() {}, refresh() {} }) }));
vi.mock('@buxa/middleware/providers/providers', () => ({
  useStore: () => ({ s: { ui: { theme: 'system' } }, actions: { setTheme: () => undefined } }),
}));
vi.mock('@/actions/account', () => ({
  updateTimeFormatAction: () => Promise.resolve({ status: 'success', message: '' }),
}));

const user = {
  id: 'u',
  name: 'Olive',
  firstName: 'Olive',
  lastName: null,
  clockFormat: null,
  email: 'olive@example.org',
};
const camp = { orgId: 'o', name: 'Lake Camp', slug: 'lake-camp', role: 'owner' as const };

function render(current: (typeof camp & { archived?: boolean }) | null) {
  return renderToStaticMarkup(
    <UiProvider Dialog={ConfirmDialog}>
      <CampFrame user={user} camps={[camp]} current={current}>
        <p>Check-in</p>
      </CampFrame>
    </UiProvider>,
  );
}

describe('CampFrame', () => {
  it('shows the archived banner above an archived camp, and the page stays readable', () => {
    const html = render({ ...camp, archived: true });
    expect(html).toContain('This camp is archived');
    expect(html.indexOf('This camp is archived')).toBeLessThan(html.indexOf('<p>Check-in</p>'));
    expect(html).toContain('<p>Check-in</p>');
  });

  it('shows no archived banner for a live camp', () => {
    expect(render({ ...camp, archived: false })).not.toContain('This camp is archived');
  });
});
