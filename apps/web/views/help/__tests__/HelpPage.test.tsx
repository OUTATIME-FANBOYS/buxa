import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HELP_PAGE, HELP_SECTIONS } from '@buxa/shared';
import { HelpPage } from '../HelpPage';

describe('HelpPage', () => {
  it('shows the help title and intro, then every section in order', () => {
    const html = renderToStaticMarkup(<HelpPage />);
    expect(html).toContain(`<h1>${HELP_PAGE.title}</h1>`);
    const positions = HELP_SECTIONS.map((s) => html.indexOf(s.title));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
