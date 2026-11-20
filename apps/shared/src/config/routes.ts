/**
 * Every URL in the web app, defined once. Links, redirects, navigation and tests all read from here,
 * so renaming a page means changing one line.
 */
export const ROUTES = {
  home: '/',
  signIn: '/sign-in',
  // The signed-in person's own profile (name, clock format, email, appearance). Needs a session only, not a camp.
  account: '/account',
  camp: '/camp',
  // Camp operations: need a signed-in session and a camp.
  members: '/camp/members',
  newCamp: '/camp/new',
  people: '/camp/people',
  newPerson: '/camp/people/new',
  checkIn: '/camp/check-in',
  onSite: '/camp/on-site',
  attendance: '/camp/attendance',
  // Sessions: date ranges that hold classes, and their enrolments. Reading needs events:read; creating, enrolling and importing need classes:manage.
  // The old /camp/classes addresses redirect here (apps/web/next.config.ts).
  sessions: '/camp/sessions',
  newSession: '/camp/sessions/new',
  sessionImport: '/camp/sessions/import',
  sessionImportTemplate: '/camp/sessions/import/template',
  sessionImportErrorReport: '/camp/sessions/import/error-report',
  // Registration: forms per season that cover sessions. Reading submissions needs registration:read; building a form needs
  // registration:manage; taking a registration needs registration:submit.
  registration: '/camp/registration',
  newRegistrationForm: '/camp/registration/new',
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

/** One session: its classes and their enrolments. */
export const sessionPath = (sessionId: string): string => `${ROUTES.sessions}/${encodeURIComponent(sessionId)}`;

/** One registration form: its questions, publishing and submissions by session. */
export const registrationFormPath = (formId: string): string => `${ROUTES.registration}/${encodeURIComponent(formId)}`;

/** The page where staff take a registration for a family, on a published form. */
export const registrationRegisterPath = (formId: string): string => `${registrationFormPath(formId)}/register`;

/** The page that adds a class to a session. */
export const newClassPath = (sessionId: string): string => `${sessionPath(sessionId)}/classes/new`;

/** The page that changes a person's details. Needs people:update. */
export const personEditPath = (id: string): string => `${personPath(id)}/edit`;

/** The board (board, list, calendar and timeline views) of one project. */
export const boardPath = (projectId: string): string => `${ROUTES.boards}/${encodeURIComponent(projectId)}`;

/** True for the camp area and everything under it (so `/camping` does not match). */
export const isCampPath = (pathname: string): boolean =>
  pathname === ROUTES.camp || pathname.startsWith(`${ROUTES.camp}/`);
