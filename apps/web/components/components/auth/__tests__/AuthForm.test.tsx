import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthForm } from '@/components/components/auth/export';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/auth/signIn', () => ({ signIn: () => settle(() => ({ status: 'idle' })) }));
vi.mock('@buxa/server/composers/auth/signUp', () => ({ signUp: () => settle(() => ({ status: 'idle' })) }));

describe('AuthForm', () => {
  it('signs in with an email and password only', () => {
    const html = renderToStaticMarkup(<AuthForm mode="in" />);
    expect(html).toContain('>Email</span>');
    expect(html).toContain('>Password</span>');
    expect(html).not.toContain('>Name</span>');
    expect(html).toContain('current-password');
    expect(html).toContain('>Sign in</button>');
  });
  it('creates an account with a name too', () => {
    const html = renderToStaticMarkup(<AuthForm mode="up" />);
    expect(html).toContain('>Name</span>');
    expect(html).toContain('>Create account</button>');
  });
});
