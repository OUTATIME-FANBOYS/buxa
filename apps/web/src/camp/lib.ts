import { can, type Action, type Role } from '@buxa/domain';

/** "Sunrise Lake Camp!" → "sunrise-lake-camp". Matches the database rule: 3-50 chars, a-z 0-9 and dashes, no dash at either end. */
export function suggestSlug(name: string): string {
  const s = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/g, '');
  return s.length >= 3 ? s : '';
}
export const SLUG_RULE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export type CampRoute = { name: 'overview' } | { name: 'members' } | { name: 'new' } | { name: 'notfound'; path: string };

/** Hashes under #/camp belong to the camp area; everything else is the legacy kanban. */
export function isCampHash(hash: string): boolean {
  const h = hash.replace(/^#\/?/, '');
  return h === '' || h === 'camp' || h.startsWith('camp/');
}
export function parseCampHash(hash: string): CampRoute {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  const [, b, ...rest] = path.split('/');
  if (rest.length) return { name: 'notfound', path };
  switch (b ?? '') {
    case '': return { name: 'overview' };
    case 'members': return { name: 'members' };
    case 'new': return { name: 'new' };
    default: return { name: 'notfound', path };
  }
}

/** What this role can do, in plain words, taken from the same rules the server enforces. */
const ABILITIES: { action: Action; label: string }[] = [
  { action: 'members:read', label: 'See who is in the camp' },
  { action: 'people:create', label: 'Add and edit people' },
  { action: 'attendance:record', label: 'Record attendance' },
  { action: 'tasks:create', label: 'Create and move staff tasks' },
  { action: 'org:update', label: 'Rename the camp' },
  { action: 'members:invite', label: 'Manage who has access' },
  { action: 'audit:read', label: 'Read the audit log' },
  { action: 'org:delete', label: 'Delete the camp' },
];
export function abilitiesFor(role: Role, userId = 'self', orgId = 'org'): { label: string; allowed: boolean }[] {
  return ABILITIES.map(a => ({ label: a.label, allowed: can({ userId, orgId, role }, a.action, a.action === 'members:invite' ? { newRole: 'viewer' } : undefined) }));
}

export const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', admin: 'Admin', staff: 'Staff', viewer: 'Viewer' };

const ORG_KEY = 'buxa.camp.org';
export const rememberOrg = (id: string) => { try { localStorage.setItem(ORG_KEY, id); } catch { /* storage may be blocked */ } };
export const recalledOrg = (): string | null => { try { return localStorage.getItem(ORG_KEY); } catch { return null; } };

export function setTheme(dark: boolean) {
  try { localStorage.setItem('buxa.theme', JSON.stringify(dark ? 'dark' : 'light')); } catch { /* ignore */ }
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
export const isDark = () => document.documentElement.dataset.theme === 'dark';
