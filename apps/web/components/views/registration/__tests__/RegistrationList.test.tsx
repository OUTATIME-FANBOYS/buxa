import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegistrationForm, RegistrationRow } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { forbidden } from '@buxa/server/http/errors';
import { settle } from '@buxa/domain';
import { ConfirmDialog } from '@/components/components';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
const session = vi.hoisted((): { role: Role | null } => ({ role: 'staff' }));
const services = vi.hoisted(() => ({
  registration: { listForms: vi.fn(), listSubmissions: vi.fn() },
  classes: { listSessions: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  notFound,
  redirect: vi.fn(),
  // The session filter moves to its chosen address with router.replace, so the page only needs the hook to exist.
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@buxa/server/session/index', () => ({
  requireSession: () => Promise.resolve({ user: { clockFormat: null } }),
}));
vi.mock('@buxa/server/composers/people/camp', () => ({
  currentActor: () => settle(() => (session.role ? { userId: 'u1', orgId: 'o1', role: session.role } : null)),
}));

const { RegistrationList } = await import('@/components/views/registration/RegistrationList');

const SUMMER = '11111111-1111-4111-8111-111111111111';
const AUTUMN = '77777777-7777-4777-8777-777777777777';
const FORM = '88888888-8888-4888-8888-888888888888';

const form: RegistrationForm = {
  id: FORM,
  name: 'Season form',
  season: '2027',
  sessions: [
    { id: SUMMER, name: 'Summer camp' },
    { id: AUTUMN, name: 'Autumn camp' },
  ],
  fields: [],
  attachments: [],
  publishedVersion: 1,
  published: {
    version: 1,
    name: 'Season form',
    season: '2027',
    sessions: [
      { id: SUMMER, name: 'Summer camp' },
      { id: AUTUMN, name: 'Autumn camp' },
    ],
    fields: [],
  },
  hasUnpublishedChanges: false,
  submissionCount: 1,
  updatedAt: '2027-06-01T00:00:00.000Z',
};

/** Ada asks for the summer session only; Ben asks for both sessions, so he appears in each. */
const ada: RegistrationRow = {
  id: 'reg-ada',
  formVersion: 1,
  submittedAt: '2027-06-01T00:00:00.000Z',
  status: 'pending',
  confirmedAt: null,
  withdrawnAt: null,
  archivedAt: null,
  standard: { camperFirstName: 'Ada', camperLastName: 'Lovelace' },
  custom: {},
  documents: [],
  sessions: [{ sessionId: SUMMER, sessionName: 'Summer camp', status: 'submitted' }],
  classes: [],
};
const ben: RegistrationRow = {
  ...ada,
  id: 'reg-ben',
  status: 'confirmed',
  standard: { camperFirstName: 'Ben', camperLastName: 'Ito' },
  sessions: [
    { sessionId: SUMMER, sessionName: 'Summer camp', status: 'submitted' },
    { sessionId: AUTUMN, sessionName: 'Autumn camp', status: 'submitted' },
  ],
};

const render = (node: ReactNode) => renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>);
const asRole = (role: Role | null) => {
  session.role = role;
};

beforeEach(() => {
  vi.clearAllMocks();
  notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  asRole('staff');
  services.classes.listSessions.mockResolvedValue({ ok: true, value: [] });
  services.registration.listForms.mockResolvedValue([form]);
  services.registration.listSubmissions.mockResolvedValue([ada, ben]);
});

describe('the Registration page', () => {
  it('lists every registration with a link to each session its registration asks for', async () => {
    const html = render(await RegistrationList());
    expect(html).toContain('aria-label="Search registrations"');
    expect(html).toContain(`href="/camp/sessions/${SUMMER}?tab=registrations"`);
    expect(html).toContain(`href="/camp/sessions/${AUTUMN}?tab=registrations"`);
  });

  it('shows Ben once per session he asks for, and Ada once', async () => {
    // Counted by their camper cells: the action buttons' names also carry the camper's name.
    const html = render(await RegistrationList());
    expect(html.match(/<td>Ben Ito<\/td>/g)).toHaveLength(2);
    expect(html.match(/<td>Ada Lovelace<\/td>/g)).toHaveLength(1);
  });

  it('still lists the forms above the registrations', async () => {
    const html = render(await RegistrationList());
    expect(html).toContain('Season form');
    expect(html.indexOf('Season form')).toBeLessThan(html.indexOf('aria-label="Search registrations"'));
  });

  it('shows a forbidden state, not the registrations, when the service refuses the read', async () => {
    services.registration.listForms.mockRejectedValue(forbidden('nope'));
    const html = render(await RegistrationList());
    expect(html).toContain('You cannot see registration forms');
    expect(html).not.toContain('Ada');
  });
});

describe('the session filter on the Registration page', () => {
  const session = (id: string, name: string, status: string) => ({
    id,
    name,
    status,
    description: '',
    startsOn: null,
    endsOn: null,
    classCount: 1,
    isPublic: false,
    archivedAt: null,
    createdAt: '2027-01-01T00:00:00.000Z',
  });

  it('shows only the registrations for the chosen session', async () => {
    const html = render(await RegistrationList({ searchParams: { session: AUTUMN } }));
    expect(html).toContain('Ben');
    expect(html).not.toContain('Ada');
    expect(html).not.toContain(`href="/camp/sessions/${SUMMER}?tab=registrations"`);
  });

  it('shows every session under All sessions (an empty session parameter)', async () => {
    const html = render(await RegistrationList({ searchParams: { session: '' } }));
    expect(html.match(/<td>Ben Ito<\/td>/g)).toHaveLength(2);
    expect(html.match(/<td>Ada Lovelace<\/td>/g)).toHaveLength(1);
  });

  it('is a search form for the session, with the chosen session selected', async () => {
    // The choice moves to its address inside the app (router.replace), so the filter is a search form, not a GET form.
    const html = render(await RegistrationList({ searchParams: { session: AUTUMN } }));
    expect(html).toContain('role="search"');
    expect(html).toContain('aria-label="Filter by session"');
    expect(html).toMatch(new RegExp(`<option value="${AUTUMN}"[^>]*selected`));
  });

  it('opens on the one live session when the URL names none', async () => {
    services.classes.listSessions.mockResolvedValue({
      ok: true,
      value: [session(SUMMER, 'Summer camp', 'live'), session(AUTUMN, 'Autumn camp', 'draft')],
    });
    const html = render(await RegistrationList());
    expect(html).toContain('Ada');
    expect(html).not.toContain(`href="/camp/sessions/${AUTUMN}?tab=registrations"`);
  });
});

describe('the forms table on the Registration page', () => {
  it('shows each form in the table with a View button named for it', async () => {
    const html = render(await RegistrationList());
    expect(html).toContain('Season form');
    expect(html).toContain('aria-label="View Season form"');
  });

  it('shows no question editor on the page: the questions are read in the View pop-up', async () => {
    const html = render(await RegistrationList());
    expect(html).not.toContain('Your questions');
    expect(html).not.toContain('Save draft');
    expect(html).not.toContain('Publish a new version');
    expect(html).not.toContain('Files for families');
  });

  it('keeps the registrations list and its search on the page for a viewer, without New Form', async () => {
    asRole('viewer');
    const html = render(await RegistrationList());
    expect(html).toContain('Season form');
    expect(html).toContain('aria-label="Search registrations"');
    expect(html).not.toContain('New Form');
  });

  it('shows New Form to an admin, who may manage forms, and not to staff', async () => {
    asRole('admin');
    expect(render(await RegistrationList())).toContain('New Form');
    asRole('staff');
    expect(render(await RegistrationList())).not.toContain('New Form');
  });
});
