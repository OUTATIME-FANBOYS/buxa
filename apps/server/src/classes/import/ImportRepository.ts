import type { Actor, ExistingSession, PlannedWrite } from '@buxa/domain';

/** What the upload audit entry records: who and when come from the actor and the clock, the rest from here. */
export interface ImportUpload {
  fileName: string;
  rows: number;
  created: number;
  updated: number;
  refused: number;
}

/**
 * Storage for a bulk import. The import rules live in @buxa/domain (planImport); this port only reads the camp's sessions and
 * writes a plan. Contract tests in `__tests__/importRepository.contract.ts` run against every adapter.
 */
export interface ImportRepository {
  /** Every session in the camp, across all classes, for the clash and duplicate checks. */
  listCampSessions(orgId: string): Promise<ExistingSession[]>;

  /**
   * Writes the whole plan in one transaction: the creates and updates, one `session.create` or `session.update` audit entry per
   * session, and one `import.upload` entry for the file. If any write fails, nothing is saved and the error is thrown.
   * An empty `writes` still records the upload, so a refused-only file is on the record.
   */
  applyImport(actor: Actor, upload: ImportUpload, writes: readonly PlannedWrite[]): Promise<void>;
}
