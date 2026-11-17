import type { ImportPlan, RowResult } from '@buxa/domain';

/**
 * The state of the bulk import page. The preview carries the file text so the confirm can check the same rows again: the server
 * keeps nothing between the two steps. Kept out of the actions file, because a 'use server' module may export only functions.
 */
export type ImportState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'preview'; fileName: string; text: string; counts: ImportPlan['counts']; results: RowResult[] }
  | { status: 'done'; fileName: string; counts: ImportPlan['counts']; written: number; changedSincePreview: boolean };

export const IMPORT_IDLE: ImportState = { status: 'idle' };
