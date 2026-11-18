import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountMenu } from '@/components/components/camp/export';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/auth/signOut', () => ({ signOut: () => settle(() => undefined) }));

describe('AccountMenu', () => {
  it('is an Account menu on the user’s avatar, with a hidden sign-out form', () => {
    const user = { id: 'u-1', name: 'Rosa Delgado', email: 'rosa@example.com' };
    const html = renderToStaticMarkup(<AccountMenu user={user} />);
    expect(html).toContain('aria-label="Account"');
    expect(html).toMatch(/class="[^"]*\bavatar-btn\b[^"]*"/);
    expect(html).toMatch(/<form[^>]*hidden=""/);
  });
});
