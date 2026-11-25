import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionNav } from '../SessionNav';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

const nav = (current: 'groups' | 'assign') =>
  renderToStaticMarkup(<SessionNav sessionId={SESSION_ID} sessionName="Summer 1" current={current} />);

/** The opening tag of the link with this text, so its class and aria-current can be checked. */
function linkTag(html: string, label: string): string {
  const match = html.match(new RegExp(`<a [^>]*>${label}</a>`));

  return match?.[0] ?? '';
}

describe('the session tabs', () => {
  it('renders both tabs as buttons, not as plain text links', () => {
    const html = nav('groups');

    for (const label of ['Groups and rooms', 'Assign people']) {
      expect(linkTag(html, label)).toMatch(/class="[^"]*\bbutton\b/);
    }
  });

  it('gives the active tab the filled primary look and aria-current="page"', () => {
    const active = linkTag(nav('assign'), 'Assign people');

    expect(active).toContain('button--primary');
    expect(active).toContain('aria-current="page"');
  });

  it('keeps the other tab as a glass button with no aria-current', () => {
    const other = linkTag(nav('assign'), 'Groups and rooms');

    expect(other).toContain('button--glass');
    expect(other).not.toContain('aria-current');
  });

  it('keeps the links to each page', () => {
    const html = nav('groups');

    expect(html).toContain(`href="/camp/sessions/${SESSION_ID}/groups"`);
    expect(html).toContain(`href="/camp/sessions/${SESSION_ID}/assign"`);
  });
});
