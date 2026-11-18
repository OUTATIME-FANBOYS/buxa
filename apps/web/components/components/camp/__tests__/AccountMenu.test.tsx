import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountMenu } from '@/components/components/camp/export';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/auth/signOut', () => ({ signOut: () => settle(() => undefined) }));
vi.mock('@/actions/account', () => ({ updateTimeFormatAction: () => Promise.resolve({ status: 'success', message: '' }) }));
vi.mock('@buxa/middleware/providers/providers', () => ({
  useStore: () => ({ s: { ui: { theme: 'system' } }, actions: { setTheme: () => undefined } }),
}));

describe('AccountMenu', () => {
  it('is an Account menu on the user’s avatar, with a hidden sign-out form', () => {
    const user = {
      id: 'u-1',
      name: 'Rosa Delgado',
      firstName: 'Rosa',
      lastName: 'Delgado',
      email: 'rosa@example.com',
      clockFormat: null,
    };
    const html = renderToStaticMarkup(<AccountMenu user={user} />);
    expect(html).toContain('aria-label="Account"');
    expect(html).toMatch(/class="[^"]*\bavatar-btn\b[^"]*"/);
    expect(html).toMatch(/<form[^>]*hidden=""/);
    expect(html).not.toContain('rosa@example.com');
  });
});
