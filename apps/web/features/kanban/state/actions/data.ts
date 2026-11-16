import type { AppState } from '../../types';
import { buildDemo } from '../../lib/demo';
import { normalize } from '../normalize';
import type { ActionContext } from './context';

export function dataActions({ get, replace }: ActionContext) {
  return {
    exportData: () => JSON.stringify(get(), null, 2),
    importData(json: string): string | null {
      try {
        const d = JSON.parse(json) as AppState;
        if (d.version !== 1 || !Array.isArray(d.tasks) || !Array.isArray(d.projects) || !Array.isArray(d.users)) return 'This file is not a Buxa export.';
        replace(normalize(d)); return null;
      } catch { return 'This file could not be read as JSON.'; }
    },
    resetDemo: () => replace(buildDemo()),
  };
}
