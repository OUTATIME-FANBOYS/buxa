import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SignInForm } from '../SignInForm';

vi.mock('@buxa/server/composers/auth/signIn', () => ({ signIn: async () => ({ status: 'idle' }) }));
vi.mock('@buxa/server/composers/auth/signUp', () => ({ signUp: async () => ({ status: 'idle' }) }));

describe('SignInForm', () => {
  it('opens in sign-in mode and offers to create an account', () => {
    const html = renderToStaticMarkup(<SignInForm />);
    expect(html).toContain('<h1>Welcome back</h1>');
    expect(html).toContain('New here?');
    expect(html).toContain('>Create an account</button>');
    expect(html).toContain('>Sign in</button>');
  });
});
