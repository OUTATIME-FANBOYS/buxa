import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { planImport, readImportFile } from '@buxa/domain';
import { CAMP_TZ } from '@buxa/server/classes/__tests__/fixtures';
import { SEASON_CSV } from '@buxa/server/composers/classes/__tests__/seasonFixture';
import { ImportResults, countsLine } from '../ImportResults';

/*
 * The preview screen, fed by the real planner and the fixture file the action tests use. The file has two ready rows, a row that
 * clashes with an earlier row in the same file, a row for a class that does not exist, and a row whose ages do not match the class.
 */
const FIXTURE = SEASON_CSV;

function previewOf(text: string) {
  const read = readImportFile(text);
  if (!read.ok) throw new Error(read.message);
  return planImport({
    rows: read.rows,
    classes: [
      { id: 'c-robotics', name: 'Robotics', ageRange: { minAge: 8, maxAge: 12 }, capacity: 2 },
      { id: 'c-painting', name: 'Painting', ageRange: { minAge: 6, maxAge: 14 }, capacity: 10 },
    ],
    sessions: [],
    timeZone: CAMP_TZ,
  });
}

describe('ImportResults (preview of the fixture file)', () => {
  const plan = previewOf(FIXTURE);
  const html = renderToStaticMarkup(<ImportResults results={plan.results} counts={plan.counts} />);

  it('says how many rows are ready and refused, and that nothing is saved yet', () => {
    expect(countsLine(plan.counts)).toBe('2 rows are ready, 3 rows are refused.');
    expect(html).toContain('Nothing is saved until you confirm.');
  });

  it('shows every row with its result, in file order', () => {
    expect(html).toContain('Ready: new');
    expect(html).toContain('Refused');
    expect(html.match(/<tr>/g)?.length).toBe(plan.results.length + 1); // rows plus the header row
  });

  it('shows the reason for each refused row, against the column that is wrong', () => {
    expect(html).toMatch(/Clashes with row 2 of this file/);
    expect(html).toMatch(/There is no class called &quot;Ghost class&quot;/);
    expect(html).toMatch(/Robotics is for ages 8 to 12/);
  });

  it('has headers for every column, so the table reads correctly with a screen reader', () => {
    for (const header of ['Row', 'Result', 'Class', 'Starts', 'Ends', 'Location', 'Reason']) {
      expect(html).toContain(`<th scope="col">${header}</th>`);
    }
    expect(html).toContain('<caption class="sr-only">Every row in the file, with its result</caption>');
  });
});
