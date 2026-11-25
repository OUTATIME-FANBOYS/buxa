import { describe, expect, it } from 'vitest';
import { parseLogFilter } from '../logFilter';

const PERSON = '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f';
const SESSION = '7a2d3c9f-0b4e-4d6f-9a81-2b3c4d5e6f70';
const CLASS = '8b3e4d0a-1c5f-4e70-8b92-3c4d5e6f7081';
const STAFF = '9c4f5e1b-2d60-4f81-9ca3-4d5e6f708192';

describe('parseLogFilter', () => {
  it('defaults both dates to today, the camp day passed in', () => {
    expect(parseLogFilter({}, '2026-11-13')).toEqual({ ok: true, filter: { from: '2026-11-13', to: '2026-11-13' } });
  });

  it('reads the range and a person', () => {
    expect(parseLogFilter({ from: '2026-11-10', to: '2026-11-12', personId: PERSON }, '2026-11-13')).toEqual({
      ok: true,
      filter: { from: '2026-11-10', to: '2026-11-12', personId: PERSON },
    });
  });

  it('reads the session, class, method, staff member and status, and they combine', () => {
    expect(
      parseLogFilter(
        {
          from: '2026-11-10',
          to: '2026-11-12',
          sessionId: SESSION,
          classId: CLASS,
          method: 'manual',
          checkedInBy: STAFF,
          status: 'on_site',
        },
        '2026-11-13',
      ),
    ).toEqual({
      ok: true,
      filter: {
        from: '2026-11-10',
        to: '2026-11-12',
        sessionId: SESSION,
        classId: CLASS,
        method: 'manual',
        checkedInBy: STAFF,
        status: 'on_site',
      },
    });
  });

  it('treats blank values as missing and takes the first of a repeated name', () => {
    expect(
      parseLogFilter(
        { from: '  ', to: ['2026-11-12', '2026-11-13'], personId: '', sessionId: '', method: '', status: '' },
        '2026-11-13',
      ),
    ).toEqual({
      ok: true,
      filter: { from: '2026-11-13', to: '2026-11-13' },
    });
  });

  it('refuses an end date before the start date', () => {
    expect(parseLogFilter({ from: '2026-11-12', to: '2026-11-10' }, '2026-11-13')).toEqual({
      ok: false,
      message: 'The end date cannot be before the start date.',
    });
  });

  it('refuses a date that does not exist', () => {
    expect(parseLogFilter({ from: '2027-02-29' }, '2026-11-13')).toMatchObject({ ok: false });
  });

  it('refuses a person id that is not a uuid', () => {
    expect(parseLogFilter({ personId: 'ada' }, '2026-11-13')).toMatchObject({ ok: false });
  });

  it('refuses a method or a status that is not on the list', () => {
    expect(parseLogFilter({ method: 'telegram' }, '2026-11-13')).toMatchObject({ ok: false });
    expect(parseLogFilter({ status: 'lost' }, '2026-11-13')).toEqual({
      ok: false,
      message: 'Choose a status from the list.',
    });
  });

  it('refuses a session, class or staff id that is not a uuid', () => {
    expect(parseLogFilter({ sessionId: 'summer' }, '2026-11-13')).toMatchObject({ ok: false });
    expect(parseLogFilter({ classId: 'art' }, '2026-11-13')).toMatchObject({ ok: false });
    expect(parseLogFilter({ checkedInBy: 'rosa' }, '2026-11-13')).toMatchObject({ ok: false });
  });
});
