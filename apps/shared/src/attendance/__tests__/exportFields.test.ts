import { describe, expect, it } from 'vitest';
import { ATTENDANCE_FIELD_IDS, DEFAULT_ATTENDANCE_FIELDS } from '@buxa/contracts';
import { orderFields, parseExportFields } from '../exportFields';

describe('parseExportFields', () => {
  it('uses the default columns when the parameter is missing', () => {
    expect(parseExportFields(null)).toEqual({ ok: true, fields: [...DEFAULT_ATTENDANCE_FIELDS] });
  });

  it('keeps the chosen columns in table order, without repeats', () => {
    expect(parseExportFields('method,person,person,in')).toEqual({ ok: true, fields: ['person', 'in', 'method'] });
  });

  it('ignores spaces around the names and blank names', () => {
    expect(parseExportFields(' person , ,session ')).toEqual({ ok: true, fields: ['person', 'session'] });
  });

  it('refuses a name that is not a column of the log', () => {
    expect(parseExportFields('person,note')).toEqual({ ok: false, message: 'Choose fields from the list.' });
  });

  it('refuses an empty choice', () => {
    expect(parseExportFields('')).toEqual({ ok: false, message: 'Choose at least one field to download.' });
    expect(parseExportFields(' , ')).toEqual({ ok: false, message: 'Choose at least one field to download.' });
  });

  it('accepts every column of the log', () => {
    expect(parseExportFields([...ATTENDANCE_FIELD_IDS].join(','))).toEqual({
      ok: true,
      fields: [...ATTENDANCE_FIELD_IDS],
    });
  });
});

describe('orderFields', () => {
  it('puts the columns in table order', () => {
    expect(orderFields(['overrideReason', 'class', 'person'])).toEqual(['person', 'class', 'overrideReason']);
  });
});
