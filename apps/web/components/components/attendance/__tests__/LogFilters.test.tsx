import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PersonSummary } from '@buxa/contracts';
import { LogFilters } from '@/components/components/attendance';

const people = [{ id: 'p-1', givenName: 'Ada', familyName: 'Lee' }] as unknown as PersonSummary[];
const choices = {
  sessions: [
    { id: 's-1', name: 'Summer 1' },
    { id: 's-2', name: 'Summer 2' },
  ],
  classes: [
    { id: 'c-swim', name: 'Swim Juniors', sessionId: 's-1' },
    { id: 'c-robot', name: 'Robotics', sessionId: 's-2' },
  ],
  staff: [{ id: 'u-rosa', name: 'Rosa Diaz' }],
};
const blank = { from: '', to: '', personId: '', sessionId: '', classId: '', method: '', checkedInBy: '', status: '' };

describe('LogFilters', () => {
  it('uses next/form, so Show navigates on the client rather than reloading the page', () => {
    const source = readFileSync(new URL('../LogFilters.tsx', import.meta.url), 'utf8');
    expect(source).toContain("import Form from 'next/form';");
    expect(source).not.toMatch(/<form[\s>]/);
  });
  it('is a bookmarkable GET form for the log, with the dates and the chosen person', () => {
    const html = renderToStaticMarkup(
      <LogFilters
        values={{ ...blank, from: '2027-07-01', to: '2027-07-03', personId: 'p-1' }}
        people={people}
        choices={choices}
      />,
    );
    expect(html).toContain('action="/camp/attendance"');
    expect(html).not.toContain('method="post"');
    expect(html).toContain('role="search"');
    expect(html).toContain('name="from" value="2027-07-01"');
    expect(html).toContain('name="to" value="2027-07-03"');
    expect(html).toContain('<option value="p-1" selected="">Ada Lee</option>');
  });
  it('offers everyone first and renders extra controls passed in', () => {
    const html = renderToStaticMarkup(
      <LogFilters values={blank} people={[]} choices={choices}>
        <a href="/x">Export</a>
      </LogFilters>,
    );
    expect(html).toContain('>Everyone</option>');
    expect(html).toContain('<a href="/x">Export</a>');
  });
  it('has Session, Class, Method, Checked in by and Status, each with its All or Any choice first', () => {
    const html = renderToStaticMarkup(<LogFilters values={blank} people={people} choices={choices} />);
    for (const label of ['Session', 'Class', 'Method', 'Checked in by', 'Status']) {
      expect(html).toContain(`>${label}</label>`);
    }
    expect(html).toContain('<option value="" selected="">All sessions</option>');
    expect(html).toContain('<option value="" selected="">All classes</option>');
    expect(html).toContain('<option value="" selected="">Any method</option>');
    expect(html).toContain('<option value="qr">Badge</option>');
    expect(html).toContain('<option value="manual">Manual</option>');
    expect(html).toContain('<option value="u-rosa">Rosa Diaz</option>');
    expect(html).toContain('<option value="on_site">Still on site</option>');
    expect(html).toContain('<option value="checked_out">Checked out</option>');
  });
  it('lists only the classes of a chosen session, and keeps the chosen values', () => {
    const html = renderToStaticMarkup(
      <LogFilters values={{ ...blank, sessionId: 's-2', classId: 'c-robot' }} people={people} choices={choices} />,
    );
    expect(html).toContain('<option value="c-robot" selected="">Robotics</option>');
    expect(html).not.toContain('Swim Juniors');
    expect(html).toContain('<option value="s-2" selected="">Summer 2</option>');
  });
});
