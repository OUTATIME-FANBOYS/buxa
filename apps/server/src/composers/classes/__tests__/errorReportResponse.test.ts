import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_COLUMNS, type Actor } from '@buxa/domain';
import { createImportService } from '../../../classes/import/ImportService';
import { InMemoryClassRepository } from '../../../classes/InMemoryClassRepository';
import { InMemoryImportRepository } from '../../../classes/import/InMemoryImportRepository';
import { CAMP_TZ, as, robotics } from '../../../classes/__tests__/fixtures';

const h = vi.hoisted(() => ({ actor: null as null | Actor, services: {} as Record<string, unknown> }));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: h.services }) }));
vi.mock('../../people/camp', () => ({ currentActor: async () => h.actor }));

const { classErrorReportResponse } = await import('../errorReportResponse');

/** One data row per entry; the header is the template's. */
const fileOf = (...rows: string[]): string => [IMPORT_COLUMNS.join(','), ...rows].join('\n');

/** Refused: the class does not exist. The class name is a spreadsheet formula, so the report must neutralise it. */
const FORMULA_ROW = ',=HYPERLINK("http://x"),2027-07-05T09:00,2027-07-05T12:00,Lab 1,8,12,5,,,';

const form = (csv: string, fileName = 'season.csv'): FormData => {
  const body = new FormData();
  body.append('fileName', fileName);
  body.append('csv', csv);
  return body;
};

beforeEach(async () => {
  const classes = new InMemoryClassRepository(() => new Date('2027-07-01T00:00:00Z'));
  const imports = new InMemoryImportRepository(classes);
  await classes.createClass(as('admin'), robotics);
  h.services = { imports: createImportService({ classes, imports, timezoneOf: async () => CAMP_TZ }) };
  h.actor = as('admin');
});

describe('classErrorReportResponse', () => {
  it('sends the refused rows as a CSV attachment, with a byte-order mark and no caching', async () => {
    const response = await classErrorReportResponse(form(fileOf(FORMULA_ROW)));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="buxa-classes-import-errors.csv"');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes).replace(/^﻿/, '');
    expect(text.split('\r\n')[0]).toBe('row,field,message,class_name,starts_at,ends_at,location');
    expect(text).toContain('class_name');
  });

  it('neutralises a spreadsheet formula in the downloaded report', async () => {
    const response = await classErrorReportResponse(form(fileOf(FORMULA_ROW)));
    const text = await response.text();
    expect(text).toContain('\'=HYPERLINK(');
    expect(text).not.toMatch(/(^|,)"?=HYPERLINK/m);
  });

  it('answers a viewer with 403 and no report', async () => {
    h.actor = as('viewer');
    const response = await classErrorReportResponse(form(fileOf(FORMULA_ROW)));
    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Disposition')).toBeNull();
    expect(await response.text()).not.toContain('HYPERLINK');
  });

  it('asks for a camp when there is none', async () => {
    h.actor = null;
    expect((await classErrorReportResponse(form(fileOf(FORMULA_ROW)))).status).toBe(404);
  });

  it('asks the person to upload again when the file text is missing', async () => {
    const body = new FormData();
    body.append('fileName', 'season.csv');
    expect((await classErrorReportResponse(body)).status).toBe(400);
  });
});
