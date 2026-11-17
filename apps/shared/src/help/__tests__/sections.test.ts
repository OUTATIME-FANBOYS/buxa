import { describe, expect, it } from 'vitest';
import { EXPORTS_SECTION } from '../exports';
import { IMPORT_COLUMNS, IMPORTS_SECTION } from '../imports';
import { PRIVACY_SECTION } from '../privacy';
import { TROUBLESHOOTING_SECTION } from '../troubleshooting';
import type { HelpSectionContent } from '../types';

// Each help section has an id (used as the #anchor), a title, and at least one subsection.
describe('help sections', () => {
  const sections: [string, HelpSectionContent][] = [
    ['exports', EXPORTS_SECTION],
    ['imports', IMPORTS_SECTION],
    ['privacy', PRIVACY_SECTION],
    ['troubleshooting', TROUBLESHOOTING_SECTION],
  ];
  it.each(sections)('%s section has an id, a title and subsections', (id, section) => {
    expect(section.id).toBeTruthy();
    expect(section.title).toBeTruthy();
    expect(section.subsections.length).toBeGreaterThan(0);
  });
  it('the import template lists its columns once each', () => {
    expect(IMPORT_COLUMNS.length).toBeGreaterThan(0);
    expect(new Set(IMPORT_COLUMNS).size).toBe(IMPORT_COLUMNS.length);
    expect(IMPORTS_SECTION.id).toBe('imports');
  });
});
