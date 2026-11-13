const ORG_KEY = 'buxa.camp.org';

/** Remembers which camp someone was working in. A per-browser convenience, so failures (blocked storage) are ignored. */
export const rememberOrg = (id: string): void => { try { localStorage.setItem(ORG_KEY, id); } catch { /* storage may be blocked */ } };
export const recalledOrg = (): string | null => { try { return localStorage.getItem(ORG_KEY); } catch { return null; } };
