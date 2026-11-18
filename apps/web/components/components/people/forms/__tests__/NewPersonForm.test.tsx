import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewPersonForm } from '@/components/components/people/forms/export';

vi.mock('@buxa/server/composers/people/createPersonAction', () => ({ createPersonAction: async () => ({ status: 'idle' }) }));

describe('NewPersonForm', () => {
  it('joins the person to the household they came from when given one', () => {
    const html = renderToStaticMarkup(<NewPersonForm household={{ id: 'h-1', name: 'The Coles' }} households={[]} />);
    expect(html).toContain('<input type="hidden" name="householdId" value="h-1"/>');
    expect(html).toContain('<strong>The Coles</strong>');
    expect(html).not.toContain('New household name');
  });
  it('lets the person join an existing household or start a new one when there is no household yet', () => {
    const html = renderToStaticMarkup(<NewPersonForm household={null} households={[{ id: 'h-1', name: 'The Coles' } as never]} />);
    expect(html).toContain('>Existing household</span>');
    expect(html).toContain('New household name');
    expect(html).toContain('>Add person</button>');
  });
  it('asks only for a new household name when the camp has no households yet', () => {
    const html = renderToStaticMarkup(<NewPersonForm household={null} households={[]} />);
    expect(html).not.toContain('Existing household');
    expect(html).toContain('New household name');
  });
  it('on its own page it keeps the panel and a Cancel link back to People', () => {
    const html = renderToStaticMarkup(<NewPersonForm household={null} households={[]} />);
    expect(html).toContain('class="panel people-form person-form"');
    expect(html).toContain('href="/camp/people"');
  });
  it('in the dialog it has no panel, and Cancel is a button, not a link away from the list', () => {
    const html = renderToStaticMarkup(<NewPersonForm household={null} households={[]} variant="dialog" />);
    expect(html).toContain('class="people-form person-form"');
    expect(html).not.toContain('href="/camp/people"');
    expect(html).toMatch(/<button[^>]*class="button button--md button--secondary"[^>]*type="button"[^>]*>Cancel<\/button>/);
  });
});
