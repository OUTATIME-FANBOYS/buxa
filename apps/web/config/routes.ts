/**
 * Every URL in the web app, defined once. Links, redirects, navigation and tests all read from here,
 * so renaming a page means changing one line.
 */
export const ROUTES = {
  home: '/',
  signIn: '/sign-in',
  camp: '/camp',
  // Camp operations: need a signed-in session and a camp.
  members: '/camp/members',
  newCamp: '/camp/new',
  people: '/camp/people',
  newPerson: '/camp/people/new',
  checkIn: '/camp/check-in',
  onSite: '/camp/on-site',
  attendance: '/camp/attendance',
  // Work: tasks kept in this browser (the kanban demo), shown in the same shell.
  tasks: '/camp/tasks',
  projects: '/camp/projects',
  boards: '/camp/boards',
  calendar: '/camp/calendar',
  agents: '/camp/agents',
  reports: '/camp/reports',
  settings: '/camp/settings',
  // Help: how to export and import, in plain words. Anyone signed in to a camp may read it.
  help: '/camp/help',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** A person's page. Ids are validated by the page, not here. */
export const personPath = (id: string): string => `${ROUTES.people}/${encodeURIComponent(id)}`;

/** The page that changes a person's details. Needs people:update. */
export const personEditPath = (id: string): string => `${personPath(id)}/edit`;

/** The board (board, list, calendar and timeline views) of one project. */
export const boardPath = (projectId: string): string => `${ROUTES.boards}/${encodeURIComponent(projectId)}`;

/** True for the camp area and everything under it (so `/camping` does not match). */
export const isCampPath = (pathname: string): boolean => pathname === ROUTES.camp || pathname.startsWith(`${ROUTES.camp}/`);
