import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotConfigured } from '@/components/components/auth';

describe('NotConfigured', () => {
  it('explains the two public settings to add and the restart, and never asks for a secret key', () => {
    const html = renderToStaticMarkup(<NotConfigured />);
    expect(html).toContain('<h1>Connect Supabase</h1>');
    expect(html).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(html).toContain('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    expect(html).toContain('Only the publishable key belongs here.');
  });
});
