import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NameSearch } from '@/components/components/attendance';
import { settle } from '@buxa/domain';

vi.mock('@buxa/server/composers/attendance/searchPeople', () => ({
  searchPeopleAction: () => settle(() => ({ kind: 'ok', value: [] })),
}));

describe('NameSearch', () => {
  it('starts with an empty search field and asks for a name', () => {
    const html = renderToStaticMarkup(<NameSearch onPick={() => undefined} />);
    expect(html).toMatch(/data-slot="label"[^>]*>Find by name</);
    expect(html).toContain('type="search"');
    expect(html).toContain('Type a name to find someone.');
    expect(html).toContain('id="name-results"');
  });
});
