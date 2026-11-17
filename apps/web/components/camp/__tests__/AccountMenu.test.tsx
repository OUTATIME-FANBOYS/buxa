import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { User } from '@buxa/contracts';
import { AccountMenu } from '../AccountMenu';

vi.mock('@buxa/server/composers/auth/signOut', () => ({ signOut: async () => undefined }));

describe('AccountMenu', () => {
  it('is an Account menu on the user’s avatar, with a hidden sign-out form', () => {
    const user = { id: 'u-1', name: 'Rosa Delgado', email: 'rosa@example.com' } as unknown as User;
    const html = renderToStaticMarkup(<AccountMenu user={user} />);
    expect(html).toContain('aria-label="Account"');
    expect(html).toContain('class="avatar-btn"');
    expect(html).toMatch(/<form[^>]*hidden=""/);
  });
});
