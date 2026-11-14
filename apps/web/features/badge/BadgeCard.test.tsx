import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BadgeCard } from './BadgeCard';

describe('BadgeCard', () => {
  const html = renderToStaticMarkup(<BadgeCard personName="Asha Rao" roleLabel="Counsellor" campName="Camp Buxa" payload="bx1.AAAAAAAAAAAAAAAAAAAAAA" />);
  it('shows name, role and camp', () => {
    expect(html).toContain('Asha Rao');
    expect(html).toContain('Counsellor');
    expect(html).toContain('Camp Buxa');
  });
  it('renders an accessible inline SVG QR with no remote or script content', () => {
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="QR code for Asha Rao/);
    expect(html).not.toMatch(/<img|<script|href=/);
  });
});
