import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CAMP_NAV_GROUPS } from '@buxa/shared/camp/navItems';

// Every page under app/(app)/camp sits in one route group named for its category (docs/CODING_STANDARDS.md, section 2).
// Route groups do not change URLs, so the folder tree and the sidebar must agree: a page is filed by what it is for.

const CAMP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'web', 'app', '(app)', 'camp');

/** The categories that exist now. Each is a route group folder directly under camp. */
const CATEGORIES = ['(operations)', '(work)', '(admin)'] as const;
/** Reserved for the parent portal (phase 6). It has no folder and no routes until that phase. */
const RESERVED_PARENT = '(parent)';
/** The Home page (/camp). It sits in (work) because it shares the work shell (WorkArea), and it is the only page allowed at a group's root. */
const HOME_FILE = '(work)/page.tsx';
/** The sidebar group label, mapped to the folder that holds its pages. Home's group is empty, and Home lives in (work). */
const GROUP_FOLDER: Record<string, string> = { '': '(work)', Operations: '(operations)', Work: '(work)', Admin: '(admin)' };

const isGroup = (segment: string) => segment.startsWith('(') && segment.endsWith(')');
const isPageFile = (name: string) => name === 'page.tsx' || name === 'route.ts';

/** Every file under camp, as a slash path relative to camp. */
function listFiles(dir: string, prefix: string[] = []): string[] {
  return readdirSync(join(dir, ...prefix), { withFileTypes: true }).flatMap(entry => {
    const here = [...prefix, entry.name];

    return entry.isDirectory() ? listFiles(dir, here) : [here.join('/')];
  });
}

const files = listFiles(CAMP);
const pageFiles = files.filter(file => isPageFile(file.split('/').pop() ?? ''));

/** The URL a page file serves: group folders are removed, the file name is dropped. */
const urlOf = (file: string) => {
  const segments = file.split('/').slice(0, -1).filter(segment => !isGroup(segment));

  return ['/camp', ...segments].join('/').replace(/\/$/, '');
};

describe('route categories', () => {
  it('puts every page and route under a listed category group', () => {
    const outside = pageFiles.filter(file => !CATEGORIES.includes(file.split('/')[0] as (typeof CATEGORIES)[number]));
    expect(outside).toEqual([]);
  });

  it('allows a page directly in a group folder only for Home', () => {
    const atGroupRoot = pageFiles.filter(file => file.split('/').length === 2);
    expect(atGroupRoot).toEqual([HOME_FILE]);
  });

  it('does not create the reserved parent group yet', () => {
    expect(existsSync(join(CAMP, RESERVED_PARENT))).toBe(false);
    expect(files.some(file => file.startsWith(`${RESERVED_PARENT}/`))).toBe(false);
  });

  it('gives every page a different URL, so no two groups resolve to the same address', () => {
    const urls = pageFiles.map(urlOf);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('files each sidebar link in the folder that matches its group', () => {
    const folderOf = new Map(pageFiles.map(file => [urlOf(file), file.split('/')[0]]));
    const wrong: string[] = [];
    for (const group of CAMP_NAV_GROUPS) {
      const folder = GROUP_FOLDER[group.label];
      expect(folder, `no folder for sidebar group "${group.label}"`).toBeDefined();
      for (const item of group.items) {
        if (folderOf.get(item.href) !== folder) {
          wrong.push(`${item.label} (${item.href}) is in ${folderOf.get(item.href) ?? 'no page'}, not ${folder}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
