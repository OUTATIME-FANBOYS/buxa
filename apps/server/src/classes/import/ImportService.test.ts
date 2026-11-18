import { describe, expect, it } from 'vitest';
import { IMPORT_COLUMNS, type Actor, settle } from '@buxa/domain';
import { isHttpError } from '../../http/errors';
import { CAMP_TZ, ORG, as, painting, robotics } from '../__tests__/fixtures';
import { InMemoryClassRepository } from '../InMemoryClassRepository';
import { InMemoryImportRepository } from './InMemoryImportRepository';
import { importTemplateCsv } from './importCsv';
import { createImportService, type ImportPreview, type ImportService } from './ImportService';

const HEADER = IMPORT_COLUMNS.join(',');
const admin = as('admin');

/** One filled row. Times are camp-local (Sydney, July is UTC+10). Robotics is ages 8 to 12, capacity 2. */
const row = (over: Partial<Record<(typeof IMPORT_COLUMNS)[number], string>> = {}): string => {
  const cells: Record<(typeof IMPORT_COLUMNS)[number], string> = {
    external_key: '', class_name: 'Robotics', starts_at: '2027-07-05T13:00', ends_at: '2027-07-05T15:00', location: 'Lab 2',
    age_min: '8', age_max: '12', capacity: '2', instructor_names: 'Ana;Ben', ratio_campers: '', ratio_instructors: '', ...over,
  };

  return IMPORT_COLUMNS.map(c => cells[c]).join(',');
};
const file = (...rows: string[]) => ({ fileName: 'season.csv', text: [HEADER, ...rows].join('\r\n') + '\r\n' });

interface World { service: ImportService; classes: InMemoryClassRepository; imports: InMemoryImportRepository }

function world(failOnWrite?: number): World {
  const classes = new InMemoryClassRepository(() => new Date('2027-07-01T00:00:00Z'));
  const imports = new InMemoryImportRepository(classes, { failOnWrite });
  const service = createImportService({ classes, imports, timezoneOf: () => settle(() => CAMP_TZ) });

  return { service, classes, imports };
}

async function withClasses(w: World): Promise<void> {
  await w.classes.createClass(admin, robotics);
  await w.classes.createClass(admin, painting);
}

const expect403 = async (p: Promise<unknown>) => {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(isHttpError(err) && err.statusCode).toBe(403);
};

const previewOf = (w: World, actor: Actor, ...rows: string[]): Promise<ImportPreview> => settle(() => w.service.preview(actor, file(...rows)));

describe('import service: permissions (classes:manage)', () => {
  it('a viewer cannot download the template, preview, confirm or export the report', async () => {
    const w = world();
    await withClasses(w);
    const viewer = as('viewer');
    await expect403(w.service.template(viewer));
    await expect403(w.service.preview(viewer, file(row())));
    const preview = await previewOf(w, admin, row());
    await expect403(w.service.confirm(viewer, preview));
    await expect403(w.service.errorReport(viewer, preview));
    expect(await w.imports.listCampSessions(ORG)).toEqual([]);
  });

  it('staff can download, preview and confirm', async () => {
    const w = world();
    await withClasses(w);
    const staff = as('staff');
    expect(await w.service.template(staff)).toBe(importTemplateCsv());
    const preview = await previewOf(w, staff, row());
    expect((await w.service.confirm(staff, preview)).written).toBe(1);
  });
});

describe('import service: preview writes nothing', () => {
  it('returns per-row results and counts, and leaves the camp unchanged', async () => {
    const w = world();
    await withClasses(w);
    const preview = await previewOf(w, admin,
      row(),                                                              // ready
      row({ starts_at: '2027-07-05T14:00', ends_at: '2027-07-05T16:00' }), // clashes with row 2 of the file
      row({ class_name: 'Chess' }),                                       // no such class
    );
    expect(preview.counts).toEqual({ create: 1, update: 0, refused: 2 });
    expect(preview.results.map(r => r.status)).toEqual(['create', 'refused', 'refused']);
    expect(preview.results[1]?.problems[0]?.message).toContain('row 2');
    expect(preview.results[2]?.problems[0]?.message).toContain('no class called "Chess"');
    expect(await w.imports.listCampSessions(ORG)).toEqual([]);
    expect(w.imports.audit).toEqual([]);
  });

  it('refuses the whole file when a column is missing, naming the column', async () => {
    const w = world();
    const without = IMPORT_COLUMNS.filter(c => c !== 'location').join(',');
    const err = await w.service.preview(admin, { fileName: 'x.csv', text: `${without}\n` }).then(() => null, (e: unknown) => e);
    expect(isHttpError(err) && err.statusCode).toBe(400);
    expect(err).toMatchObject({ message: 'The column "location" is missing from the header row.' });
  });

  it('refuses a file name that is empty', async () => {
    const w = world();
    await expect(w.service.preview(admin, { fileName: '  ', text: `${HEADER}\n` })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('import service: confirm', () => {
  it('writes every ready row, and the audit trail: one upload and one entry per session', async () => {
    const w = world();
    await withClasses(w);
    const preview = await previewOf(w, admin, row(), row({ class_name: 'Painting', starts_at: '2027-07-05T16:00', ends_at: '2027-07-05T18:00', location: 'Studio', age_min: '6', age_max: '14', capacity: '10', instructor_names: '' }));
    const result = await w.service.confirm(admin, preview);
    expect(result).toMatchObject({ written: 2, counts: { create: 2, update: 0, refused: 0 }, changedSincePreview: false });
    expect(await w.imports.listCampSessions(ORG)).toHaveLength(2);
    expect(w.imports.audit.map(a => a.action)).toEqual(['import.upload', 'session.create', 'session.create']);
    expect(w.imports.audit[0]?.data).toMatchObject({ fileName: 'season.csv', rows: 2, created: 2, updated: 0, refused: 0 });
  });

  it('re-uploading the same file with external keys updates, and creates nothing new', async () => {
    const w = world();
    await withClasses(w);
    const keyed = row({ external_key: 'ROB-1' });
    await w.service.confirm(admin, await previewOf(w, admin, keyed));
    const again = await w.service.confirm(admin, await previewOf(w, admin, keyed));
    expect(again).toMatchObject({ written: 1, counts: { create: 0, update: 1, refused: 0 } });
    expect(await w.imports.listCampSessions(ORG)).toHaveLength(1);
  });

  it('re-uploading rows without keys refuses them as duplicates and creates nothing', async () => {
    const w = world();
    await withClasses(w);
    await w.service.confirm(admin, await previewOf(w, admin, row()));
    const again = await w.service.confirm(admin, await previewOf(w, admin, row()));
    expect(again).toMatchObject({ written: 0, counts: { create: 0, update: 0, refused: 1 } });
    expect(again.results[0]?.problems[0]?.message).toContain('already in the camp');
    expect(await w.imports.listCampSessions(ORG)).toHaveLength(1);
  });

  it('re-checks against current data: a row ready at preview is refused if a clash appeared since', async () => {
    const w = world();
    await withClasses(w);
    const preview = await previewOf(w, admin, row());
    expect(preview.counts.create).toBe(1);
    const robotics13 = (await w.classes.listClasses(ORG)).find(c => c.name === 'Robotics');
    w.imports.seedSession(ORG, {
      id: '99999999-9999-4999-8999-999999999999', classId: robotics13?.id ?? '', className: 'Robotics',
      startsAt: '2027-07-05T03:30:00.000Z', endsAt: '2027-07-05T04:30:00.000Z', location: 'Lab 9', capacity: 2, seatsTaken: 0, externalKey: null,
    });
    const result = await w.service.confirm(admin, preview);
    expect(result).toMatchObject({ written: 0, changedSincePreview: true, counts: { refused: 1 } });
    expect(await w.imports.listCampSessions(ORG)).toHaveLength(1);
  });

  it('a failure part-way through saves nothing from the file', async () => {
    const w = world(2);
    await withClasses(w);
    const preview = await previewOf(w, admin, row(), row({ starts_at: '2027-07-06T13:00', ends_at: '2027-07-06T15:00' }), row({ starts_at: '2027-07-07T13:00', ends_at: '2027-07-07T15:00' }));
    await expect(w.service.confirm(admin, preview)).rejects.toThrow('Injected failure on write 2');
    expect(await w.imports.listCampSessions(ORG)).toEqual([]);
    expect(w.imports.audit).toEqual([]);
  });

  it('a file with only refused rows is still recorded as an upload, and writes no session', async () => {
    const w = world();
    await withClasses(w);
    const result = await w.service.confirm(admin, await previewOf(w, admin, row({ class_name: 'Chess' })));
    expect(result.written).toBe(0);
    expect(w.imports.audit.map(a => a.action)).toEqual(['import.upload']);
    expect(w.imports.audit[0]?.data).toMatchObject({ refused: 1 });
  });

  it('does not create a class for an unknown class name', async () => {
    const w = world();
    await withClasses(w);
    const before = (await w.classes.listClasses(ORG)).length;
    await w.service.confirm(admin, await previewOf(w, admin, row({ class_name: 'Chess' })));
    expect((await w.classes.listClasses(ORG)).length).toBe(before);
  });
});

describe('import service: error report', () => {
  it('lists refused rows and neutralises a formula typed into a cell', async () => {
    const w = world();
    await withClasses(w);
    const preview = await previewOf(w, admin, row({ class_name: '=HYPERLINK("http://x")' }));
    const report = await w.service.errorReport(admin, preview);
    expect(report.split('\r\n')[0]).toBe('row,field,message,class_name,starts_at,ends_at,location');
    expect(report).toContain('\'=HYPERLINK');
  });
});
