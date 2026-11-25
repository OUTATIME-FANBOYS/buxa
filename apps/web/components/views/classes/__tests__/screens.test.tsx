import { ConfirmDialog } from '@/components/components';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Class, Enrolment, PersonSummary, Session } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { forbidden } from '@buxa/server/http/errors';
import { settle } from '@buxa/domain';
import { seriesOf } from './seriesOf';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Kept: the compiler needs this assertion to type the value; removing it fails typecheck.
const session = vi.hoisted(() => ({ role: 'staff' as Role | null }));
const services = vi.hoisted(() => ({
  classes: {
    listSessions: vi.fn(),
    getSession: vi.fn(),
    listSeries: vi.fn(),
    listSeriesOccurrences: vi.fn(),
    getClass: vi.fn(),
    listEnrolments: vi.fn(),
  },
  people: { list: vi.fn() },
  orgs: { getCamp: vi.fn(), listMembers: vi.fn() },
  seatHolds: { listActiveHolds: vi.fn(() => Promise.resolve([])) },
}));

vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@buxa/server/session/index', () => ({
  requireSession: () => Promise.resolve({ user: { clockFormat: null } }),
}));
vi.mock('@buxa/server/composers/people/camp', () => ({
  currentActor: () => settle(() => (session.role ? { userId: 'u1', orgId: 'o1', role: session.role } : null)),
}));
vi.mock('@/actions/classes', () => ({
  createSessionAction: vi.fn(),
  updateSeriesAction: vi.fn(),
  deleteSeriesAction: vi.fn(),
  cancelOccurrenceAction: vi.fn(),
  restoreOccurrenceAction: vi.fn(),
  deleteClassAction: vi.fn(),
  updateSessionAction: vi.fn(),
  deleteSessionAction: vi.fn(),
  deleteSessionWithClassesAction: vi.fn(),
  setSessionArchivedAction: vi.fn(),
  publishSessionAction: vi.fn(),
  sessionDeleteImpactAction: vi.fn(),
  enrolAction: vi.fn(),
  promoteWaitlistAction: vi.fn(),
  cancelEnrolmentAction: vi.fn(),
  addSeriesAction: vi.fn(),
  importClassesAction: vi.fn(),
}));

const { ClassList } = await import('@/components/views/classes');
const { ClassPage } = await import('@/components/views/classes');
const { NewSession } = await import('@/components/views/classes');
const { NewClass } = await import('@/components/views/classes');
const { ImportClasses } = await import('@/components/views/classes');

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const CLASS_ID = '22222222-2222-4222-8222-222222222222';
const ADA = '33333333-3333-4333-8333-333333333333';
const INSTRUCTOR_ID = '66666666-6666-4666-8666-666666666666';

const parent: Session = {
  id: SESSION_ID,
  name: 'Summer camp',
  description: 'Two weeks in July.',
  startsOn: '2027-07-01',
  endsOn: '2027-07-14',
  classCount: 1,
  isPublic: false,
  status: 'live',
  archivedAt: null,
  createdAt: '2027-07-01T00:00:00.000Z',
};
// Full: two places, both taken, and one on the waitlist. Monday 5 July 2027, 09:00 to 12:00 in Sydney.
const full: Class = {
  id: CLASS_ID,
  sessionId: SESSION_ID,
  sessionName: 'Summer camp',
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 2,
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Lab 1',
  instructorIds: [INSTRUCTOR_ID],
  instructors: [{ id: INSTRUCTOR_ID, name: 'Ivy Chen' }],
  seatsTaken: 2,
  waitlisted: 1,
  datesOutsideSession: false,
  seriesId: 'series-1',
  occurrenceStatus: 'active',
  cancelReason: null,
  price: null,
};
const enrolment: Enrolment = {
  id: '44444444-4444-4444-8444-444444444444',
  classId: CLASS_ID,
  className: 'Robotics',
  camperId: ADA,
  camperName: 'Ada Lovelace',
  status: 'enrolled',
  enrolledAt: '2027-07-01T00:00:00.000Z',
  overrideReason: null,
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
  services.orgs.getCamp.mockResolvedValue({ timezone: 'Australia/Sydney' });
  services.orgs.listMembers.mockResolvedValue({ members: [] });
  services.classes.listSessions.mockResolvedValue({ ok: true, value: [parent] });
  services.classes.getSession.mockResolvedValue({ ok: true, value: parent });
  services.classes.listSeries.mockResolvedValue({ ok: true, value: seriesOf([full]) });
  services.classes.getClass.mockResolvedValue({ ok: true, value: full });
  services.classes.listEnrolments.mockResolvedValue({ ok: true, value: [enrolment] });
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Kept: the compiler needs this assertion to type the value; removing it fails typecheck.
  services.people.list.mockResolvedValue([
    { id: ADA, givenName: 'Ada', familyName: 'Lovelace', roles: ['camper'] },
  ] as unknown as PersonSummary[]);
});

describe('ClassList (the Sessions page)', () => {
  it('shows the sessions, and for staff the New session and import buttons', async () => {
    const html = render(await ClassList());
    expect(html).toContain('Summer camp');
    expect(html).toContain('>New session</button>');
    expect(html).toContain('href="/camp/sessions/import"');
  });

  it('shows a viewer the sessions with no create or import buttons', async () => {
    asRole('viewer');
    const html = render(await ClassList());
    expect(html).toContain('Summer camp');
    expect(html).not.toContain('New session');
    expect(html).not.toContain('href="/camp/sessions/import"');
  });

  it('shows a forbidden state, not an error, when the service refuses the read', async () => {
    services.classes.listSessions.mockRejectedValue(forbidden('nope'));
    const html = render(await ClassList());
    expect(html).toContain('You cannot see sessions');
  });

  it('shows no deleted notice when nothing was just deleted (the notice itself is tested in DeletedSessionToast)', async () => {
    const html = render(await ClassList());
    expect(html).not.toContain('Deleted &quot;');
  });
});

describe('ClassPage (one session and its classes)', () => {
  it('shows the session name, its dates, and its classes with the full state', async () => {
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: {} }));
    expect(html).toContain('Two weeks in July.');
    expect(html).toContain('2027-07-01 to 2027-07-14');
    expect(html).toContain('Robotics');
    expect(html).toContain('Full, with a waitlist');
    expect(html).toContain('>New class</button>');
  });

  it('has no Add a weekly series button: New class sets the days of the week itself', async () => {
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: {} }));
    expect(html).not.toContain('Add a weekly series');
    expect(html).toContain('>New class</button>');
  });

  it('shows the Camp Size column and the class ages, with no instructor ratio', async () => {
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: {} }));
    expect(html).toContain('Camp Size');
    expect(html).toContain('8 to 12');
    expect(html).not.toContain('Instructor ratio');
  });

  it('offers only the waitlist for a full class, and explains why', async () => {
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: { class: CLASS_ID } }));
    expect(html).toContain('2 of 2 places taken, 1 on the waitlist.');
    expect(html).toContain('This class is full. A camper can join the waitlist instead.');
    expect(html).toContain('Add to waitlist');
  });

  it('lists the enrolled campers by name, with a cancel button for staff', async () => {
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: { class: CLASS_ID } }));
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Withdraw');
  });

  it('gives a viewer the schedule and names, with no add, edit, delete, enrol or cancel controls', async () => {
    asRole('viewer');
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: { class: CLASS_ID } }));
    expect(html).toContain('Ada Lovelace');
    expect(html).not.toContain('New class');
    expect(html).not.toContain('Edit Robotics');
    expect(html).not.toContain('Delete Robotics');
    expect(html).not.toContain('Add to waitlist');
    expect(html).not.toContain('Withdraw');
  });

  it('says the viewer cannot see who is enrolled, when the service refuses the list', async () => {
    services.classes.listEnrolments.mockRejectedValue(forbidden('nope'));
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: { class: CLASS_ID } }));
    expect(html).toContain('You cannot see who is enrolled');
  });

  it('is not found when the session is not in this camp', async () => {
    services.classes.getSession.mockResolvedValue({
      ok: false,
      failure: { reason: 'session_not_found', message: 'That session no longer exists.' },
    });
    await expect(ClassPage({ classId: SESSION_ID, searchParams: {} })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it("ignores a class id that is not one of this session's classes", async () => {
    const html = render(
      await ClassPage({ classId: SESSION_ID, searchParams: { class: '99999999-9999-4999-8999-999999999999' } }),
    );
    expect(html).not.toContain('id="enrolments"');
  });

  it("shows the selected class's instructors by name, in the class details", async () => {
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: { class: CLASS_ID } }));
    expect(html).toContain('aria-label="Class details"');
    expect(html).toContain('<dt>Instructors</dt><dd>Ivy Chen</dd>');
  });

  it('shows the instructor names in the Instructors column, and None yet for a class with none', async () => {
    const unstaffed: Class = {
      ...full,
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Painting',
      instructorIds: [],
      instructors: [],
    };
    services.classes.listSeries.mockResolvedValue({ ok: true, value: seriesOf([full, unstaffed]) });
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: {} }));
    expect(html).toContain('<td>Ivy Chen</td>');
    expect(html).toContain('<td>None yet</td>');
  });

  it('has no Teachers section, for staff or an admin', async () => {
    for (const role of ['staff', 'admin'] as const) {
      asRole(role);
      const html = render(await ClassPage({ classId: SESSION_ID, searchParams: {} }));
      expect(html).not.toContain('Teachers');
      expect(html).not.toContain('teachers-heading');
    }
  });
});

describe('NewSession (create a session)', () => {
  it('shows the form to staff, with the date fields and no class fields', async () => {
    const html = render(await NewSession());
    expect(html).toContain('name="startsOn"');
    expect(html).toContain('name="endsOn"');
    expect(html).not.toContain('name="startsAt"');
  });

  it('gives a viewer the forbidden state and no form', async () => {
    asRole('viewer');
    const html = render(await NewSession());
    expect(html).toContain('You cannot create sessions');
    expect(html).not.toContain('name="startsOn"');
  });
});

describe('NewClass (add a class to a session)', () => {
  it('shows the class form to staff, with the session in its heading', async () => {
    const html = render(await NewClass({ sessionId: SESSION_ID }));
    expect(html).toContain('name="startsAt"');
    expect(html).toContain('A new class in Summer camp.');
    expect(html).toContain('name="capacity"');
  });

  it('gives a viewer the forbidden state and no form', async () => {
    asRole('viewer');
    const html = render(await NewClass({ sessionId: SESSION_ID }));
    expect(html).toContain('You cannot add classes');
    expect(html).not.toContain('name="startsAt"');
  });
});

describe('ImportClasses (bulk import)', () => {
  it('offers the template, the upload and the column list to staff', async () => {
    const html = render(await ImportClasses());
    expect(html).toContain('href="/camp/sessions/import/template"');
    expect(html).toContain('type="file"');
    expect(html).toContain('external_key, class_name, starts_at');
  });

  it('gives a viewer the forbidden state with no template, upload or confirm', async () => {
    asRole('viewer');
    const html = render(await ImportClasses());
    expect(html).toContain('You cannot import sessions');
    expect(html).not.toContain('Download the template');
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain('Save ');
  });
});
