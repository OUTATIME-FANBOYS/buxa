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
  people: '/camp/people',
  newPerson: '/camp/people/new',
  checkIn: '/camp/check-in',
  onSite: '/camp/on-site',
  attendance: '/camp/attendance',
  /** The original single-user kanban demo. Client-only, keeps its data in the browser. */
  kanban: '/kanban',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** A person's page. Ids are validated by the page, not here. */
export const personPath = (id: string): string => `${ROUTES.people}/${encodeURIComponent(id)}`;

/** The page that changes a person's details. Needs people:update. */
export const personEditPath = (id: string): string => `${personPath(id)}/edit`;

/** True for the camp area and everything under it (so `/camping` does not match). */
export const isCampPath = (pathname: string): boolean => pathname === ROUTES.camp || pathname.startsWith(`${ROUTES.camp}/`);
