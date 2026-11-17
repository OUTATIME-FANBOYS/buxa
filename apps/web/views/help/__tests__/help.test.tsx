import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HELP_SECTIONS } from '@/logic/common';
import { IMPORTS_SECTION } from '@/logic/common';
import { EXPORTS_SECTION } from '@/logic/common';
import { CodeBlock } from '@/components';
import { ExampleTable } from '@/components';
import { HelpPage } from '../HelpPage';
import { HelpSection } from '@/components';

/** The heading levels in the order they appear in the markup, for example ['h1', 'h2', 'h3']. */
const headingLevels = (html: string): string[] => [...html.matchAll(/<(h[1-6])[ >]/g)].map(m => m[1] ?? '');
const headingTexts = (html: string): string[] => [...html.matchAll(/<h[1-6][^>]*>([^<]*)<\/h[1-6]>/g)].map(m => m[1] ?? '');

describe('HelpPage', () => {
  const html = renderToStaticMarkup(<HelpPage />);

  it('shows the page title once, as the only h1', () => {
    expect(headingLevels(html).filter(level => level === 'h1')).toHaveLength(1);
    expect(headingTexts(html)[0]).toBe('Help');
  });

  it('puts the section headings in order, each subsection heading below its section', () => {
    const levels = headingLevels(html);
    expect(levels[0]).toBe('h1');
    for (let i = 1; i < levels.length; i++) {
      // A heading may only step down one level at a time: no h3 straight after the h1.
      const prev = Number(levels[i - 1]?.slice(1));
      const cur = Number(levels[i]?.slice(1));
      expect(cur).toBeLessThanOrEqual(prev + 1);
    }
    const sectionTitles = HELP_SECTIONS.map(s => s.title);
    const h2s = headingTexts(html).filter((_, i) => levels[i] === 'h2');
    expect(h2s).toEqual(sectionTitles);
  });

  it('gives every section its anchor, so /camp/help#exports and #imports land on it', () => {
    expect(html).toContain('id="exports"');
    expect(html).toContain('id="imports"');
  });
});

describe('HelpSection', () => {
  it('renders the title as h2, steps as an ordered list, and a subsection heading as h3', () => {
    const html = renderToStaticMarkup(<HelpSection section={EXPORTS_SECTION} />);
    expect(html).toContain('<h2 id="help-exports">Exports</h2>');
    expect(html).toContain('<h3>Attendance CSV</h3>');
    expect(html).toContain('<ol class="help-steps">');
    expect(html).toContain('<li>Press Show to check the list, then press Download CSV.</li>');
  });

  it('labels the import section Not available yet, and does not label the exports', () => {
    const imports = renderToStaticMarkup(<HelpSection section={IMPORTS_SECTION} />);
    const exports = renderToStaticMarkup(<HelpSection section={EXPORTS_SECTION} />);
    expect(imports).toContain('Not available yet.');
    expect(imports).toContain('Phase 2');
    expect(exports).not.toContain('Not available yet');
  });
});

describe('ExampleTable', () => {
  it('renders a header row and one body row per example', () => {
    const html = renderToStaticMarkup(<ExampleTable caption="Columns" headers={['Column', 'Example']} rows={[['starts_at', '2027-06-07T09:00'], ['age_min', '8']]} />);
    expect(html).toContain('<th scope="col">Column</th>');
    expect(html.match(/<tr>/g)).toHaveLength(3);
    expect(html).toContain('<td>2027-06-07T09:00</td>');
    expect(html).toContain('<caption class="muted">Columns</caption>');
  });

  it('shows the import column example values in the table', () => {
    const html = renderToStaticMarkup(<HelpSection section={IMPORTS_SECTION} />);
    expect(html).toContain('<td>ROB-W1-MON</td>');
    expect(html).toContain('<td>Priya Shah;Tom Reyes</td>');
    expect(html.match(/<tbody>.*?<\/tbody>/s)?.[0].match(/<tr>/g)).toHaveLength(11);
  });
});

describe('CodeBlock', () => {
  it('shows the caption and each line on its own line, without changing the text', () => {
    const html = renderToStaticMarkup(<CodeBlock caption="Header" lines={['a,b', 'c,d']} />);
    expect(html).toContain('<figcaption class="muted">Header</figcaption>');
    expect(html).toContain('<code>a,b\nc,d</code>');
  });
});
