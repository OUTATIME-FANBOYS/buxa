/**
 * Where the chosen light/dark theme is remembered, defined once. The camp area and the kanban demo both read and write it.
 * `public/theme-init.js` (a plain script that must run before React to avoid a flash) cannot import this, so it repeats the two strings;
 * `theme.test.ts` fails if they ever differ.
 */
export const THEME_KEY = 'buxa.theme';
/** The key an earlier version used. Read as a fallback and removed once the new one is saved. */
export const LEGACY_THEME_KEY = 'tessera.theme';
/** Fired on `window` whenever the theme is chosen outside the kanban store (the account menu), so the store follows the same choice. */
export const THEME_EVENT = 'buxa:theme';
