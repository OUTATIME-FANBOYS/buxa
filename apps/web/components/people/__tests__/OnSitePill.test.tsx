import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnSitePill } from '../OnSitePill';

describe('OnSitePill', () => {
  it('marks someone who is checked in and not yet out', () => {
    expect(renderToStaticMarkup(<OnSitePill onSite />)).toContain('>On site</span>');
  });
  it('shows nothing otherwise, so "not on site" is never a visible marker', () => {
    expect(renderToStaticMarkup(<OnSitePill onSite={false} />)).toBe('');
    expect(renderToStaticMarkup(<OnSitePill onSite={null} />)).toBe('');
  });
});
