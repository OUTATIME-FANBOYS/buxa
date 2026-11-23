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
  it('puts the monochrome logo in the card after the QR code, hidden from assistive technology', () => {
    const logo = html.indexOf('class="badge-logo"');
    expect(logo).toBeGreaterThan(html.indexOf('class="badge-qr"'));
    expect(html).toMatch(
      /<svg class="badge-logo" viewBox="0 0 32 32" aria-hidden="true"[^>]*><path fill="currentColor"/,
    );
    // One fill: the logo's path has no second colour.
    const logoSvg = html.slice(logo, html.indexOf('</svg>', logo));
    expect(logoSvg.match(/fill="/g)).toHaveLength(1);
  });
  it('keeps the QR code at its own size: the logo adds no size to it', () => {
    expect(html).toMatch(/<svg class="badge-qr" viewBox="0 0 \d+ \d+"/);
  });
  it('renders an accessible inline SVG QR with no remote or script content', () => {
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="QR code for Asha Rao/);
    expect(html).not.toMatch(/<img|<script|href=/);
  });
});
