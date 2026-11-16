import { describe, expect, it } from 'vitest';
import { parseLogFilter } from './logFilter';

const PERSON = '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f';

describe('parseLogFilter', () => {
  it('defaults both dates to today, the camp day passed in', () => {
    expect(parseLogFilter({}, '2026-11-13')).toEqual({ ok: true, filter: { from: '2026-11-13', to: '2026-11-13' } });
  });

  it('reads the range and a person', () => {
    expect(parseLogFilter({ from: '2026-11-10', to: '2026-11-12', personId: PERSON }, '2026-11-13'))
      .toEqual({ ok: true, filter: { from: '2026-11-10', to: '2026-11-12', personId: PERSON } });
  });

  it('treats blank values as missing and takes the first of a repeated name', () => {
    expect(parseLogFilter({ from: '  ', to: ['2026-11-12', '2026-11-13'], personId: '' }, '2026-11-13'))
      .toEqual({ ok: true, filter: { from: '2026-11-13', to: '2026-11-13' } });
  });

  it('refuses an end date before the start date', () => {
    expect(parseLogFilter({ from: '2026-11-12', to: '2026-11-10' }, '2026-11-13'))
      .toEqual({ ok: false, message: 'The end date cannot be before the start date.' });
  });

  it('refuses a date that does not exist', () => {
    expect(parseLogFilter({ from: '2027-02-29' }, '2026-11-13')).toMatchObject({ ok: false });
  });

  it('refuses a person id that is not a uuid', () => {
    expect(parseLogFilter({ personId: 'ada' }, '2026-11-13')).toMatchObject({ ok: false });
  });
});
