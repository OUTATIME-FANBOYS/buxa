/**
 * Every URL in the web app, defined once. Links, redirects, navigation and tests all read from here,
 * so renaming a page means changing one line.
 */
export const ROUTES = {
  home: '/',
  signIn: '/sign-in',
  camp: '/camp',
  members: '/camp/members',
  newCamp: '/camp/new',
  /** The original single-user kanban demo. Client-only, keeps its data in the browser. */
  kanban: '/kanban',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** True for the camp area and everything under it (so `/camping` does not match). */
export const isCampPath = (pathname: string): boolean => pathname === ROUTES.camp || pathname.startsWith(`${ROUTES.camp}/`);
