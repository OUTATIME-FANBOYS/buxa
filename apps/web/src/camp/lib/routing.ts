export type CampRoute =
  | { name: 'overview' }
  | { name: 'members' }
  | { name: 'new' }
  | { name: 'notfound'; path: string };

const pathOf = (hash: string): string => hash.replace(/^#\/?/, '').split('?')[0];

/** The bare address (no hash). It redirects to the camp home. */
export const isEmptyHash = (hash: string): boolean => pathOf(hash) === '';

/** Hashes under #/camp (and the empty hash) belong to the camp area; everything else is the original kanban app. */
export function isCampHash(hash: string): boolean {
  const path = pathOf(hash);
  return path === '' || path === 'camp' || path.startsWith('camp/');
}

export function parseCampHash(hash: string): CampRoute {
  const path = pathOf(hash);
  const [, section, ...extra] = path.split('/');
  if (extra.length) return { name: 'notfound', path };
  switch (section ?? '') {
    case '': return { name: 'overview' };
    case 'members': return { name: 'members' };
    case 'new': return { name: 'new' };
    default: return { name: 'notfound', path };
  }
}

export const go = (to: string): void => { location.hash = to; };
