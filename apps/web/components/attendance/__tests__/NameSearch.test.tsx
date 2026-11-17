import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NameSearch } from '../NameSearch';

vi.mock('@buxa/server/composers/attendance/searchPeople', () => ({ searchPeopleAction: async () => ({ kind: 'ok', value: [] }) }));

describe('NameSearch', () => {
  it('starts with an empty search field and asks for a name', () => {
    const html = renderToStaticMarkup(<NameSearch onPick={() => undefined} />);
    expect(html).toContain('<span class="field-label">Find by name</span>');
    expect(html).toContain('type="search"');
    expect(html).toContain('Type a name to find someone.');
    expect(html).toContain('id="name-results"');
  });
});
