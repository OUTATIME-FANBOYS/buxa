import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../config/routes';
import { HELP_LINK_LABEL, HELP_SECTIONS, helpLink } from '../content';
import { IMPORT_COLUMNS } from '../imports';
import { type HelpSectionContent, type HelpSubsection } from '../types';

/** The import columns as the phase 2 bulk import spec names them (docs/phases/02-events-calendar.md, "Template columns"). */
const SPEC_COLUMNS = [
  'external_key', 'class_name', 'starts_at', 'ends_at', 'location', 'age_min', 'age_max', 'capacity', 'instructor_names', 'ratio_campers', 'ratio_instructors',
];

const section = (id: string): HelpSectionContent => {
  const found = HELP_SECTIONS.find(s => s.id === id);
  if (!found) throw new Error(`no section ${id}`);
  return found;
};

/** Every word of a section's text, including table cells and code lines, so a column named anywhere counts. */
const textOf = (s: HelpSectionContent): string => JSON.stringify(s);

describe('the import instructions and the spec cannot drift apart', () => {
  it('names the columns in the same order as the spec', () => {
    expect([...IMPORT_COLUMNS]).toEqual(SPEC_COLUMNS);
  });

  it.each(SPEC_COLUMNS)('the import section names the spec column %s', column => {
    expect(textOf(section('imports'))).toContain(column);
  });

  it('gives each spec column a row in the column table', () => {
    const sub = section('imports').subsections.find(s => s.id === 'import-columns');
    const names = sub?.table?.rows.map(row => row[0]);
    expect(names).toEqual(SPEC_COLUMNS);
  });

  it('puts every column in the template header line, in spec order', () => {
    const sub = section('imports').subsections.find(s => s.code);
    expect(sub?.code?.lines[0]).toBe(SPEC_COLUMNS.join(','));
  });

  it('gives the example row one value per column', () => {
    const sub = section('imports').subsections.find(s => s.code);
    expect(sub?.code?.lines[1]?.split(',')).toHaveLength(SPEC_COLUMNS.length);
  });

  it('keeps the rule words of the spec: overlap, age range, capacity, external key, atomic save', () => {
    const text = textOf(section('imports'));
    for (const word of ['overlap', 'age', 'capacity', 'external key', 'Saving is all or nothing']) expect(text).toContain(word);
  });
});

describe('the help content', () => {
  it('has the four sections in page order, with anchors that match the links', () => {
    expect(HELP_SECTIONS.map(s => s.id)).toEqual(['exports', 'imports', 'privacy', 'troubleshooting']);
    expect(new Set(HELP_SECTIONS.map(s => s.id)).size).toBe(HELP_SECTIONS.length);
  });

  it('marks the import section Not available yet, with the phase name', () => {
    const availability = section('imports').availability;
    expect(availability?.label).toBe('Not available yet');
    expect(availability?.detail).toContain('Phase 2');
  });

  it('does not mark the exports as unavailable', () => {
    expect(section('exports').availability).toBeUndefined();
  });

  it('describes the attendance export limit and the byte-order mark', () => {
    const text = textOf(section('exports'));
    expect(text).toContain('5000');
    expect(text).toContain('byte-order mark');
  });

  it('covers the privacy rule and the three troubleshooting cases', () => {
    expect(textOf(section('privacy'))).toContain('medical notes');
    const headings = section('troubleshooting').subsections.map((s: HelpSubsection) => s.heading);
    expect(headings.join(' ')).toMatch(/overlaps/);
    expect(headings.join(' ')).toMatch(/Excel changed my time/);
    expect(headings.join(' ')).toMatch(/can’t see a button/);
  });

  it('builds the link to a section under the help route', () => {
    expect(helpLink('exports')).toBe(`${ROUTES.help}#exports`);
    expect(helpLink('imports')).toBe('/camp/help#imports');
    expect(HELP_LINK_LABEL).toBe('Help');
  });
});
