import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Class, Session } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { settle } from '@buxa/domain';
import { Dialog as ConfirmDialog } from '@/components/components';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
const session = vi.hoisted((): { role: Role | null } => ({ role: 'staff' }));
const services = vi.hoisted(() => ({
  classes: {
    getSession: vi.fn(),
    listClasses: vi.fn(),
    listEnrolments: vi.fn(),
    listCampWaitlists: vi.fn(),
  },
  people: { list: vi.fn() },
  orgs: { getCamp: vi.fn(), listMembers: vi.fn() },
  seatHolds: { listActiveHolds: vi.fn(), listCampActiveHolds: vi.fn() },
  registration: { listForms: vi.fn(), listSubmissions: vi.fn() },
}));

vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@buxa/server/session/index', () => ({
  requireSession: () => Promise.resolve({ user: { clockFormat: null } }),
}));
vi.mock('@buxa/server/composers/people/camp', () => ({
  currentActor: () => settle(() => (session.role ? { userId: 'u1', orgId: 'o1', role: session.role } : null)),
}));

const { ClassPage } = await import('@/components/views/classes');

const SUMMER = '11111111-1111-4111-8111-111111111111';
const AUTUMN = '77777777-7777-4777-8777-777777777777';
const CLASS_ID = '22222222-2222-4222-8222-222222222222';
const FORM_SUMMER = '88888888-8888-4888-8888-888888888888';
const FORM_AUTUMN = '99999999-9999-4999-8999-999999999999';

const summer: Session = {
  id: SUMMER,
  name: 'Summer camp',
  description: 'Two weeks in July.',
  startsOn: '2027-07-01',
  endsOn: '2027-07-14',
  classCount: 1,
  isPublic: false,
  archivedAt: null,
  createdAt: '2027-07-01T00:00:00.000Z',
};
const autumn: Session = { ...summer, id: AUTUMN, name: 'Autumn camp', description: 'Autumn weeks.' };

const robotics: Class = {
  id: CLASS_ID,
  sessionId: SUMMER,
  sessionName: 'Summer camp',
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 2,
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Lab 1',
  instructorIds: [],
  instructors: [],
  seatsTaken: 0,
  waitlisted: 0,
  price: null,
};

const submission = (id: string, first: string, last: string, sessionId: string, sessionName: string) => ({
  id,
  formVersion: 1,
  submittedAt: '2027-06-01T00:00:00.000Z',
  status: 'pending' as const,
  confirmedAt: null,
  standard: { camperFirstName: first, camperLastName: last, guardianPhone: '0400 000 000' },
  custom: {},
  sessions: [{ sessionId, sessionName, status: 'submitted' as const }],
  classes: [
    {
      id: `place-${id}`,
      classId: CLASS_ID,
      className: 'Robotics',
      sessionId,
      sessionName,
      camperId: `camper-${id}`,
      camperName: `${first} ${last}`,
      status: 'held' as const,
      paymentStatus: 'unpaid' as const,
      paymentNote: null,
    },
  ],
});

const hold = (id: string, sessionId: string, sessionName: string, household: string) => ({
  id,
  sessionId,
  sessionName,
  classId: CLASS_ID,
  className: 'Robotics',
  householdId: `house-${id}`,
  householdName: household,
  childName: null,
  createdAt: '2027-07-05T08:50:00.000Z',
  expiresAt: '2027-07-05T09:05:00.000Z',
});

const render = (node: ReactNode) => renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>);
const asRole = (role: Role | null) => {
  session.role = role;
};

/** The tab whose button is marked as the open one (Segmented marks it aria-checked). */
function activeTab(html: string): string | undefined {
  for (const match of html.matchAll(/<button([^>]*)>/g)) {
    const attrs = match[1] ?? '';
    if (attrs.includes('aria-checked="true"')) {
      return /title="([^"]*)"/.exec(attrs)?.[1];
    }
  }

  return undefined;
}

const page = (tab: string | string[] | undefined, sessionId = SUMMER) =>
  ClassPage({ classId: sessionId, searchParams: tab === undefined ? {} : { tab } });

beforeEach(() => {
  vi.clearAllMocks();
  notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  asRole('staff');
  services.orgs.getCamp.mockResolvedValue({ timezone: 'Australia/Sydney' });
  services.orgs.listMembers.mockResolvedValue({ members: [] });
  services.classes.getSession.mockImplementation((_actor: unknown, id: string) =>
    Promise.resolve({ ok: true, value: id === AUTUMN ? autumn : summer }),
  );
  services.classes.listClasses.mockResolvedValue({ ok: true, value: [robotics] });
  services.classes.listEnrolments.mockResolvedValue({ ok: true, value: [] });
  services.people.list.mockResolvedValue([]);
  services.seatHolds.listActiveHolds.mockResolvedValue([]);
  services.seatHolds.listCampActiveHolds.mockResolvedValue([
    hold('hold-summer', SUMMER, 'Summer camp', 'Okafor family'),
    hold('hold-autumn', AUTUMN, 'Autumn camp', 'Ito family'),
  ]);
  services.classes.listCampWaitlists.mockResolvedValue([]);
  services.registration.listForms.mockResolvedValue([
    {
      id: FORM_SUMMER,
      name: 'Summer form',
      season: null,
      sessions: [{ id: SUMMER, name: 'Summer camp' }],
      fields: [],
      publishedVersion: 1,
      submissionCount: 1,
      updatedAt: '2027-06-01T00:00:00.000Z',
    },
    {
      id: FORM_AUTUMN,
      name: 'Autumn form',
      season: null,
      sessions: [{ id: AUTUMN, name: 'Autumn camp' }],
      fields: [],
      publishedVersion: 1,
      submissionCount: 1,
      updatedAt: '2027-06-01T00:00:00.000Z',
    },
  ]);
  services.registration.listSubmissions.mockImplementation((_actor: unknown, formId: string) =>
    Promise.resolve(
      formId === FORM_SUMMER
        ? [submission('ada', 'Ada', 'Lovelace', SUMMER, 'Summer camp')]
        : [submission('ben', 'Ben', 'Ito', AUTUMN, 'Autumn camp')],
    ),
  );
});

describe('the session page tabs', () => {
  it('shows the three tabs to someone who can read registration, with Classes open by default', async () => {
    const html = render(await page(undefined));
    expect(html).toContain('aria-label="Session sections"');
    expect(html).toContain('title="Registrations"');
    expect(html).toContain('title="Holds"');
    expect(activeTab(html)).toBe('Classes');
    expect(html).toContain('Robotics');
  });

  it('selects the tab the URL names', async () => {
    expect(activeTab(render(await page('registrations')))).toBe('Registrations');
    expect(activeTab(render(await page('holds')))).toBe('Holds');
    expect(activeTab(render(await page('classes')))).toBe('Classes');
  });

  it('falls back to Classes for an unknown or repeated tab', async () => {
    const unknown = render(await page('bogus'));
    expect(activeTab(unknown)).toBe('Classes');
    expect(unknown).toContain('Robotics');
    expect(unknown).not.toContain('Summer form');
    expect(activeTab(render(await page(['holds', 'registrations'])))).toBe('Classes');
  });

  it('renders the Registrations tab for its session only', async () => {
    const html = render(await page('registrations'));
    expect(html).toContain('Summer form');
    expect(html).toContain('Ada');
    expect(html).not.toContain('Autumn form');
    expect(html).not.toContain('Ben');
    expect(html).not.toContain('Places held');
  });

  it('renders the Holds tab for its session only', async () => {
    const html = render(await page('holds'));
    expect(html).toContain('Places held');
    expect(html).toContain('Okafor family');
    expect(html).not.toContain('Ito family');
    expect(html).not.toContain('Session filter');
    expect(html).not.toContain('All sessions');
  });

  it('renders the Classes tab with the existing class content and no registrations or holds', async () => {
    const html = render(await page(undefined));
    expect(html).toContain('Two weeks in July.');
    expect(html).not.toContain('Summer form');
    expect(html).not.toContain('Places held');
  });

  it('keeps the tab content for the session in the URL, not the other session', async () => {
    const html = render(await page('registrations', AUTUMN));
    expect(html).toContain('Autumn form');
    expect(html).toContain('Ben');
    expect(html).not.toContain('Summer form');
  });

  it('hides the tabs from a viewer, and a viewer who asks for a registration tab sees Classes', async () => {
    asRole('viewer');
    const html = render(await page('registrations'));
    expect(html).not.toContain('aria-label="Session sections"');
    expect(html).not.toContain('title="Registrations"');
    expect(html).not.toContain('title="Holds"');
    expect(html).not.toContain('Summer form');
    expect(html).toContain('Robotics');
  });

  it('hides the tabs from a teacher, and a teacher who asks for the holds tab sees Classes', async () => {
    asRole('teacher');
    const html = render(await page('holds'));
    expect(html).not.toContain('aria-label="Session sections"');
    expect(html).not.toContain('title="Holds"');
    expect(html).not.toContain('Places held');
    expect(html).toContain('Robotics');
  });

  it('shows the tabs to an admin, the same as staff', async () => {
    asRole('admin');
    const html = render(await page(undefined));
    expect(html).toContain('title="Registrations"');
    expect(html).toContain('title="Holds"');
  });
});
