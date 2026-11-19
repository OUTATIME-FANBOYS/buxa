import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NewClassButton, NewSessionButton } from '@/components/components/classes/forms';

vi.mock('@/actions/classes', () => ({
  createSessionAction: vi.fn(),
  addClassAction: vi.fn(),
  updateClassAction: vi.fn(),
  deleteClassAction: vi.fn(),
}));

describe('the New session and New class buttons', () => {
  it('the Sessions page button is labelled New session', () => {
    expect(renderToStaticMarkup(<NewSessionButton />)).toContain('New session');
  });

  it('the session page button is labelled New class, and is not the old New session label', () => {
    const html = renderToStaticMarkup(
      <NewClassButton
        sessionId="11111111-1111-4111-8111-111111111111"
        sessionName="Summer camp"
        timeZone="Australia/Sydney"
        instructors={[]}
      />,
    );
    expect(html).toContain('New class');
    expect(html).not.toContain('New session');
    expect(html).toContain('aria-haspopup="dialog"');
  });
});
