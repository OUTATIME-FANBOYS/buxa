import type { AppState } from '@buxa/shared';
import { buildDemo } from '@buxa/shared';
import { normalize } from '@buxa/shared';
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
