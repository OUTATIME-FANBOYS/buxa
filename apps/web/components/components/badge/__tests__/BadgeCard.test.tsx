import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BadgeCard } from '@/components/components/badge';

describe('BadgeCard', () => {
  const html = renderToStaticMarkup(
    <BadgeCard
      personName="Asha Rao"
      roleLabel="Counsellor"
      campName="Camp Buxa"
      payload="bx1.AAAAAAAAAAAAAAAAAAAAAA"
    />,
  );
  it('shows name, role and camp', () => {
    expect(html).toContain('Asha Rao');
    expect(html).toContain('Counsellor');
    expect(html).toContain('Camp Buxa');
  });
  it('has no logo in the top-right corner: the mark is only at the centre of the QR code', () => {
    expect(html).not.toContain('class="badge-logo"');
  });
  it('draws the mark at the centre of the QR: a white square with a black mark, hidden from assistive technology', () => {
    const logo = html.indexOf('class="badge-qr-logo"');
    expect(logo).toBeGreaterThan(html.indexOf('class="badge-qr"'));
    const logoSvg = html.slice(logo, html.indexOf('</svg></svg>', logo));
    expect(logoSvg).toContain('aria-hidden="true"');
    expect(logoSvg).toContain('<rect width="32" height="32" fill="#fff">');
    expect(logoSvg).toMatch(/<path d="M6 27 L16 10[^"]*" fill="#000" fill-rule="evenodd">/);
  });
  it('keeps the QR code as a module path, with the logo as a separate element on top of it', () => {
    const qr = html.slice(html.indexOf('class="badge-qr"'), html.indexOf('</svg></section>'));
    expect(qr).toMatch(/^class="badge-qr" viewBox="0 0 \d+ \d+"/);
    // The module path is the QR's own element; the logo is a nested svg after it, not part of that path.
    expect(qr.indexOf('<path d="M4 4h1v1h-1z')).toBeGreaterThan(-1);
    expect(qr.indexOf('class="badge-qr-logo"')).toBeGreaterThan(qr.indexOf('fill="#000"></path>'));
  });
  it('renders an accessible inline SVG QR with no remote or script content', () => {
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="QR code for Asha Rao/);
    expect(html).not.toMatch(/<img|<script|href=/);
  });
});
