import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Empty } from '@/components/components/export';

describe('Empty', () => {
  it('shows the title, the optional body and action, and the default inbox icon', () => {
    const html = renderToStaticMarkup(<Empty title="Nothing here" body="Add one to start." action={<a href="/new">New</a>} />);
    expect(html).toContain('<strong>Nothing here</strong>');
    expect(html).toContain('<p>Add one to start.</p>');
    expect(html).toContain('<a href="/new">New</a>');
    expect(html).toContain('class="empty-icon"');
  });
  it('leaves out the body when there is none', () => {
    expect(renderToStaticMarkup(<Empty title="Empty" />)).not.toContain('<p>');
  });
});
