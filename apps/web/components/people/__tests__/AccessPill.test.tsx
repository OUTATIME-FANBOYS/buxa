import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccessPill } from '../AccessPill';

describe('AccessPill', () => {
  it('shows the membership status in words, in its tone', () => {
    expect(renderToStaticMarkup(<AccessPill status="valid" />)).toBe('<span class="pill pill-ok"><i class="pill-dot" aria-hidden="true"></i>Valid</span>');
    expect(renderToStaticMarkup(<AccessPill status="revoked" />)).toContain('Revoked');
  });
  it('renders nothing when the status is withheld', () => {
    expect(renderToStaticMarkup(<AccessPill status={null} />)).toBe('');
  });
});
