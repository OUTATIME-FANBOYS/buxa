import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PersonSummary } from '@buxa/contracts';
import { LogFilters } from '../LogFilters';

const people = [{ id: 'p-1', givenName: 'Ada', familyName: 'Lee', preferredName: null }] as unknown as PersonSummary[];

describe('LogFilters', () => {
  it('is a plain GET form for the log, with the dates and the chosen person', () => {
    const html = renderToStaticMarkup(<LogFilters values={{ from: '2027-07-01', to: '2027-07-03', personId: 'p-1' }} people={people} />);
    expect(html).toContain('method="get"');
    expect(html).toContain('role="search"');
    expect(html).toContain('name="from" value="2027-07-01"');
    expect(html).toContain('name="to" value="2027-07-03"');
    expect(html).toContain('<option value="p-1" selected="">Ada Lee</option>');
  });
  it('offers everyone first and renders extra controls passed in', () => {
    const html = renderToStaticMarkup(<LogFilters values={{ from: '', to: '', personId: '' }} people={[]}><a href="/x">Export</a></LogFilters>);
    expect(html).toContain('>Everyone</option>');
    expect(html).toContain('<a href="/x">Export</a>');
  });
});
