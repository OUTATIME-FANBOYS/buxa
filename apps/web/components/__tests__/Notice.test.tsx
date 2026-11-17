import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Notice } from '../Notice';

describe('Notice', () => {
  it('a critical notice is an alert, anything else is a polite status', () => {
    expect(renderToStaticMarkup(<Notice tone="crit" title="Refused" body="Not today." />)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Notice tone="ok" title="Checked in" />)).toContain('role="status"');
  });
  it('shows the title and the body', () => {
    const html = renderToStaticMarkup(<Notice tone="ok" title="Checked in" body="At 09:00." />);
    expect(html).toContain('Checked in');
    expect(html).toContain('<p>At 09:00.</p>');
  });
  it('shows an icon with the title, so the tone is not carried by colour alone', () => {
    const html = renderToStaticMarkup(<Notice tone="warn" title="Check the list" />);
    expect(html).toContain('class="notice-title"');
    expect(html).toContain('<svg');
  });
});
