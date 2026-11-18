import {
  MAX_IMPORT_ROWS,
  planImport,
  readImportFile,
  type Actor,
  type ClassRef,
  type ImportPlan,
  type ImportRow,
  type RowResult,
  settle,
} from '@buxa/domain';
import { assertAllowed } from '../../auth/authorize';
import { badRequest } from '../../http/errors';
import type { ClassRepository } from '../ClassRepository';
import type { ImportRepository } from './ImportRepository';
import { importErrorReportCsv, importTemplateCsv } from './importCsv';

/*
 * The bulk import of classes' sessions: download the template, upload a filled file, see every row's result, then confirm.
 *
 * Decisions (the three open questions in docs/phases/02-events-calendar.md):
 * - A missing class refuses the row and names it. An import never creates a class: the owner creates the class first.
 * - Who confirms: classes:manage, the same permission as creating a session by hand. The preview needs the same permission, because
 *   it reads the camp's whole schedule.
 * - Overrides: not in this version. A row that clashes is refused, and an admin fixes the row in the file.
 */

export const MAX_FILE_NAME = 255;

export interface ImportFile {
  fileName: string;
  text: string;
}

/** What the owner sees before confirming. `input` is the file as read, kept so the confirm can re-check it against current data. */
export interface ImportPreview {
  fileName: string;
  counts: ImportPlan['counts'];
  results: RowResult[];
  input: ImportRow[];
}

export interface ImportConfirmation {
  fileName: string;
  counts: ImportPlan['counts'];
  results: RowResult[];
  /** Sessions written by this confirm: the creates and updates that were ready when it ran. */
  written: number;
  /** True when a row's outcome differs from the preview, because the camp's data changed in between. */
  changedSincePreview: boolean;
}

export interface ImportService {
  template(actor: Actor): Promise<string>;
  preview(actor: Actor, file: ImportFile): Promise<ImportPreview>;
  confirm(actor: Actor, preview: ImportPreview): Promise<ImportConfirmation>;
  errorReport(actor: Actor, preview: ImportPreview): Promise<string>;
}

export interface ImportServiceDeps {
  classes: ClassRepository;
  imports: ImportRepository;
  /** The camp's IANA zone (orgs.timezone): the zone the file's times are written in. */
  timezoneOf(orgId: string): Promise<string>;
}

export function createImportService({ classes, imports, timezoneOf }: ImportServiceDeps): ImportService {
  /** The plan for these rows against the camp's current classes and sessions. Reads only. */
  async function planFor(orgId: string, rows: readonly ImportRow[]): Promise<ImportPlan> {
    const classRefs: ClassRef[] = (await classes.listClasses(orgId)).map(c => ({
      id: c.id,
      name: c.name,
      ageRange: c.ageRange,
      capacity: c.capacity,
    }));
    const sessions = await imports.listCampSessions(orgId);

    return planImport({ rows: [...rows], classes: classRefs, sessions, timeZone: await timezoneOf(orgId) });
  }

  return {
    template(actor) {
      return settle(() => {
        assertAllowed(actor, 'classes:manage');

        return importTemplateCsv();
      });
    },

    async preview(actor, file) {
      assertAllowed(actor, 'classes:manage');
      const fileName = file.fileName.trim();
      if (fileName === '' || fileName.length > MAX_FILE_NAME) {
        throw badRequest(`Give the file a name of ${MAX_FILE_NAME} characters or fewer.`);
      }
      const read = readImportFile(file.text);
      if (!read.ok) {
        throw badRequest(read.message);
      }
      const plan = await planFor(actor.orgId, read.rows);

      return { fileName, counts: plan.counts, results: plan.results, input: read.rows };
    },

    async confirm(actor, preview) {
      assertAllowed(actor, 'classes:manage');
      if (preview.input.length > MAX_IMPORT_ROWS) {
        throw badRequest(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
      }
      // The camp's data may have changed since the preview, so the rows are checked again and only the fresh result is written.
      const fresh = await planFor(actor.orgId, preview.input);
      await imports.applyImport(
        actor,
        {
          fileName: preview.fileName,
          rows: preview.input.length,
          created: fresh.counts.create,
          updated: fresh.counts.update,
          refused: fresh.counts.refused,
        },
        fresh.writes,
      );

      return {
        fileName: preview.fileName,
        counts: fresh.counts,
        results: fresh.results,
        written: fresh.writes.length,
        changedSincePreview: outcomeOf(preview.results) !== outcomeOf(fresh.results),
      };
    },

    errorReport(actor, preview) {
      return settle(() => {
        assertAllowed(actor, 'classes:manage');

        return importErrorReportCsv(preview.results);
      });
    },
  };
}

/** Each row's status and problems, as a string, to compare a preview with a fresh check. */
const outcomeOf = (results: readonly RowResult[]): string =>
  JSON.stringify(results.map(r => [r.rowNumber, r.status, r.problems]));
