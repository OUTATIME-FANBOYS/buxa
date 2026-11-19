import { SEASON_CSV } from './seasonFixture';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@buxa/domain';
import { createClassService } from '../../../classes/ClassService';
import { InMemoryClassRepository } from '../../../classes/InMemoryClassRepository';
import { InMemoryImportRepository } from '../../../classes/import/InMemoryImportRepository';
import { createImportService } from '../../../classes/import/ImportService';
import { CAMP_TZ, ORG, as, painting, robotics } from '../../../classes/__tests__/fixtures';
import { importClassesAction } from '../importClassesAction';
import { IMPORT_IDLE, type ImportState } from '@buxa/shared';
import { settle } from '@buxa/domain';

const h = vi.hoisted(() => ({
  actor: null as null | Actor,
  services: {},
}));
vi.mock('../../../runtime', () => ({ getRuntime: () => ({ services: h.services }) }));
vi.mock('../../people/camp', () => ({ currentActor: () => settle(() => h.actor) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** The real fixture: a Robotics pair that clashes within the file, an unknown class, an age mismatch, and two ready rows. */
const SEASON = SEASON_CSV;

let classes: InMemoryClassRepository;
let imports: InMemoryImportRepository;

/** A preview as the page sends it: the file in a FormData, the way the browser posts it. */
const upload = (text: string, fileName = 'season.csv'): FormData => {
  const form = new FormData();
  form.append('intent', 'preview');
  form.append('file', new File([text], fileName, { type: 'text/csv' }));

  return form;
};

/** The confirm step: the file text comes back from the preview state, as the confirm form posts it. */
const confirmOf = (state: Extract<ImportState, { status: 'preview' }>): FormData => {
  const form = new FormData();
  form.append('intent', 'confirm');
  form.append('fileName', state.fileName);
  form.append('csv', state.text);

  return form;
};

beforeEach(async () => {
  classes = new InMemoryClassRepository(() => new Date('2027-07-01T00:00:00Z'));
  imports = new InMemoryImportRepository(classes);
  await classes.createClass(as('admin'), robotics);
  await classes.createClass(as('admin'), painting);
  h.actor = as('admin');
  h.services = {
    imports: createImportService({ classes, imports, timezoneOf: () => settle(() => CAMP_TZ) }),
    classes: createClassService({ repo: classes, timezoneOf: () => settle(() => CAMP_TZ) }),
  };
});

describe('importClassesAction: preview (nothing is written)', () => {
  it('checks every row of the file and returns a result for each', async () => {
    const state = await importClassesAction(IMPORT_IDLE, upload(SEASON));
    expect(state).toMatchObject({
      status: 'preview',
      fileName: 'season.csv',
      counts: { create: 2, update: 0, refused: 3 },
    });
    if (state.status !== 'preview') {
      throw new Error('expected a preview');
    }
    expect(state.results.map(r => [r.rowNumber, r.status])).toEqual([
      [2, 'create'],
      [3, 'refused'],
      [4, 'refused'],
      [5, 'create'],
      [6, 'refused'],
    ]);
  });

  it('gives each refused row its reason, against the column that is wrong', async () => {
    const state = await importClassesAction(IMPORT_IDLE, upload(SEASON));
    if (state.status !== 'preview') {
      throw new Error('expected a preview');
    }
    const byRow = Object.fromEntries(state.results.map(r => [r.rowNumber, r.problems]));
    expect(byRow[3]?.[0]?.message).toMatch(/clashes with row 2/i); // clashes with row 2 in the same file
    expect(byRow[4]?.[0]).toMatchObject({ field: 'class_name' }); // no class called "Ghost class"
    expect(byRow[6]?.[0]).toMatchObject({ field: 'age_min' }); // ages do not match the class
  });

  it('writes nothing during the preview', async () => {
    await importClassesAction(IMPORT_IDLE, upload(SEASON));
    expect(await imports.listCampSessions(ORG)).toEqual([]);
  });

  it('asks for a file when none is chosen, and reads only CSV-sized files', async () => {
    expect(await importClassesAction(IMPORT_IDLE, new FormData())).toEqual({
      status: 'error',
      message: 'Choose a CSV file to upload.',
    });
    const empty = new FormData();
    empty.append('file', new File([], 'empty.csv', { type: 'text/csv' }));
    expect(await importClassesAction(IMPORT_IDLE, empty)).toEqual({
      status: 'error',
      message: 'Choose a CSV file to upload.',
    });
  });

  it('names the missing column when the header does not match the template', async () => {
    const state = await importClassesAction(IMPORT_IDLE, upload('class_name,starts_at\nRobotics,2027-07-05T13:00\n'));
    expect(state).toEqual({ status: 'error', message: 'The column "external_key" is missing from the header row.' });
  });

  it('refuses a viewer with the forbidden message and writes nothing', async () => {
    h.actor = as('viewer');
    expect(await importClassesAction(IMPORT_IDLE, upload(SEASON))).toEqual({
      status: 'error',
      message: 'Your role cannot do this.',
    });
  });
});

describe('importClassesAction: confirm (one transaction)', () => {
  it('saves the ready rows and records the counts', async () => {
    const preview = await importClassesAction(IMPORT_IDLE, upload(SEASON));
    if (preview.status !== 'preview') {
      throw new Error('expected a preview');
    }
    const done = await importClassesAction(preview, confirmOf(preview));
    expect(done).toMatchObject({
      status: 'done',
      fileName: 'season.csv',
      written: 2,
      counts: { create: 2, refused: 3 },
      changedSincePreview: false,
    });
    expect(await imports.listCampSessions(ORG)).toHaveLength(2);
  });

  it('asks the person to upload again when the preview text is missing', async () => {
    const form = new FormData();
    form.append('intent', 'confirm');
    expect(await importClassesAction(IMPORT_IDLE, form)).toEqual({
      status: 'error',
      message: 'Upload the file again, then confirm.',
    });
  });
});
