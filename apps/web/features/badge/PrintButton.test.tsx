import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PrintButton } from './PrintButton';

describe('PrintButton', () => {
  it('is a plain button, labelled for the badge, that the print styles hide', () => {
    const html = renderToStaticMarkup(<PrintButton />);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*class="btn badge-print-btn"|<button[^>]*class="btn badge-print-btn"[^>]*type="button"/);
    expect(html).toContain('Print badge');
  });
});
