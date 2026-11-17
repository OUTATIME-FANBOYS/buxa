import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Icon } from '@/components/elements/export';
import { ICON_PATHS } from '@/components/elements/export';

describe('Icon', () => {
  it('renders a decorative 24-unit stroked svg with the named glyph', () => {
    const html = renderToStaticMarkup(<Icon name="plus" size={20} className="x" />);
    expect(html).toContain('<svg class="x" width="20" height="20" viewBox="0 0 24 24"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<path d="M12 5v14M5 12h14"></path>');
  });
  it('defaults to 16 and renders nothing inside for an unknown name', () => {
    const html = renderToStaticMarkup(<Icon name="does-not-exist" />);
    expect(html).toContain('width="16"');
    expect(html).toMatch(/<\/svg>$/);
  });
});

describe('ICON_PATHS', () => {
  it('has the glyphs the screens use', () => {
    for (const name of ['plus', 'search', 'kanban', 'calendar', 'users']) {
      expect(ICON_PATHS[name]).toBeTruthy();
    }
  });
});
