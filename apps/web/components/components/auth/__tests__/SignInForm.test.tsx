import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SignInForm } from '@/components/components/auth';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/auth/signIn', () => ({ signIn: () => settle(() => ({ status: 'idle' })) }));
vi.mock('@buxa/server/composers/auth/signUp', () => ({ signUp: () => settle(() => ({ status: 'idle' })) }));

describe('SignInForm', () => {
  it('opens in sign-in mode and offers to create an account', () => {
    const html = renderToStaticMarkup(<SignInForm next="/camp" />);
    expect(html).toContain('<h1>Welcome back</h1>');
    expect(html).toContain('New here?');
    expect(html).toContain('>Create an account</button>');
    expect(html).toContain('>Sign in</button>');
  });
});
