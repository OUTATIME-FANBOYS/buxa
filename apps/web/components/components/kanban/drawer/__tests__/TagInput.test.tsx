import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TagInput } from '@/components/components/kanban/drawer';

describe('TagInput', () => {
  it('shows each tag with a remove control, and the add prompt when there are none', () => {
    const html = renderToStaticMarkup(<TagInput tags={['family']} onChange={vi.fn()} suggestions={[]} />);
    expect(html).toContain('>family<button');
    expect(html).toContain('aria-label="Remove tag family"');
    expect(renderToStaticMarkup(<TagInput tags={[]} onChange={vi.fn()} suggestions={[]} />)).toContain(
      'placeholder="Add tags"',
    );
  });
  it('offers the workspace’s tags as suggestions, leaving out the ones already chosen', () => {
    const html = renderToStaticMarkup(
      <TagInput tags={['family']} onChange={vi.fn()} suggestions={['family', 'medical']} />,
    );
    expect(html).toContain('<datalist id="tag-suggestions">');
    expect(html).toMatch(/<option value="medical"/);
    expect(html).not.toMatch(/<option value="family"/);
  });
});
