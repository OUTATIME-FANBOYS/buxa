import type { PeopleTab } from '../camp/peopleTabs';
import type { SessionTab } from '../camp/sessionTabs';

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
  // Manage access: change each member's role. Needs members:change_role (admins and the owner).
  membersManage: '/camp/members/manage',
  newCamp: '/camp/new',
  people: '/camp/people',
  // Opens the Add person pop-up on the People page (the page itself has no add address).
  addPerson: '/camp/people?add=person',
  // One household: its members and every edit to it. Needs people:read to see it; the edits need the same rights as on a person.
  households: '/camp/households',
  checkIn: '/camp/check-in',
  onSite: '/camp/on-site',
  attendance: '/camp/attendance',
  // Sessions: date ranges that hold classes, and their enrolments. Reading needs events:read; creating, enrolling and importing need classes:manage.
  // The old /camp/classes addresses redirect here (apps/web/next.config.ts).
  sessions: '/camp/sessions',
  // A teacher's own classes, grouped by session. Read only; teachers only (anyone else gets not found).
  myClasses: '/camp/my-classes',
  newSession: '/camp/sessions/new',
  sessionImport: '/camp/sessions/import',
  sessionImportTemplate: '/camp/sessions/import/template',
  sessionImportErrorReport: '/camp/sessions/import/error-report',
  // Registration: forms that cover sessions. Reading submissions needs registration:read; building a form needs
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

/** One tab of a session's page. The URL keeps it in `?tab=`, so refresh and back return to it. Classes is the default tab. */
export const sessionTabPath = (sessionId: string, tab: SessionTab): string => `${sessionPath(sessionId)}?tab=${tab}`;

/** One registration form: its questions, publishing and submissions by session. */
export const registrationFormPath = (formId: string): string => `${ROUTES.registration}/${encodeURIComponent(formId)}`;

/**
 * A file a form offers families (a blank immunization form, say). The session is the one the family registers for: the download
 * route checks the form covers it, so a link is only as good as its session.
 */
export const registrationFormFilePath = (fileId: string, sessionId: string): string =>
  `${ROUTES.registration}/files/${encodeURIComponent(fileId)}?session=${encodeURIComponent(sessionId)}`;

/** A document a family sent with a registration, for staff to open and check. */
export const registrationDocumentPath = (fileId: string): string =>
  `${ROUTES.registration}/documents/${encodeURIComponent(fileId)}`;

/** The page where staff take a registration for a family, on a published form. */
export const registrationRegisterPath = (formId: string): string => `${registrationFormPath(formId)}/register`;

/** A session's groups and rooms page (phase 4). Needs classes:manage to change them; everyone reads them. */
export const groupsPath = (sessionId: string): string => `${sessionPath(sessionId)}/groups`;

/** A session's assign page: groups with their members, and a way to place or move a person. Needs classes:manage to change. */
export const assignPath = (sessionId: string): string => `${sessionPath(sessionId)}/assign`;

/** A session's roster as a printable page (phase 4). Needs the same read as the Groups and Assign screens. */
export const rosterPrintPath = (sessionId: string): string => `${sessionPath(sessionId)}/roster`;

/** A session's roster as a CSV download (phase 4). Needs the same read as the Groups and Assign screens. */
export const rosterCsvPath = (sessionId: string): string => `${sessionPath(sessionId)}/roster.csv`;

/** The page that adds a class to a session. */
export const newClassPath = (sessionId: string): string => `${sessionPath(sessionId)}/classes/new`;

/** The page that changes a person's details. Needs people:update. */
export const personEditPath = (id: string): string => `${personPath(id)}/edit`;

/** The People page on one of its tabs (`people` or `households`). The URL keeps the tab in `?tab=`, so refresh and back return to it. */
export const peopleTabPath = (tab: PeopleTab): string => `${ROUTES.people}?tab=${tab}`;

/** One household's page: its members and every edit to the household. */
export const householdPath = (id: string): string => `${ROUTES.households}/${encodeURIComponent(id)}`;

/** The board (board, list, calendar and timeline views) of one project. */
export const boardPath = (projectId: string): string => `${ROUTES.boards}/${encodeURIComponent(projectId)}`;

/** True for the camp area and everything under it (so `/camping` does not match). */
export const isCampPath = (pathname: string): boolean =>
  pathname === ROUTES.camp || pathname.startsWith(`${ROUTES.camp}/`);
