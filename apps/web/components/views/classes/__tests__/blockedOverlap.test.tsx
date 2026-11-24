import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Class, Session } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import { settle } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { Dialog as ConfirmDialog } from '@/components/components';
import { idle } from '@buxa/shared';
import { ActionMessage } from '@/components/components/classes/forms/ActionMessage';
import { attempt } from '@buxa/server/classes/outcome';
import { refusalError } from '@buxa/server/classes/errors';
import { enrolAction } from '@buxa/server/composers/classes/enrolAction';

// The blocked-overlap path end to end: the service refuses a clash, the outcome carries the clashing class, the composer hands its
// message to the form, and the form shows it. The override field is offered to admins only.
const services = vi.hoisted(() => ({
  classes: {
    enrol: vi.fn(),
    getSession: vi.fn(),
    listClasses: vi.fn(),
    getClass: vi.fn(),
    listSessions: vi.fn(),
    listEnrolments: vi.fn(),
    listTeacherAssignments: vi.fn(),
  },
  people: { list: vi.fn() },
  orgs: { getCamp: vi.fn(), listMembers: vi.fn() },
  seatHolds: { listActiveHolds: vi.fn(() => Promise.resolve([])) },
}));
const session = vi.hoisted<{ role: Role | null }>(() => ({ role: 'staff' }));
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@buxa/server/session/index', () => ({
  requireSession: () => Promise.resolve({ user: { clockFormat: null } }),
}));
vi.mock('@buxa/server/composers/people/camp', () => ({
  currentActor: () => settle(() => (session.role ? { userId: 'u1', orgId: 'o1', role: session.role } : null)),
}));
const { ClassPage } = await import('@/components/views/classes');

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const PAINTING_CLASS = '22222222-2222-4222-8222-222222222222';
const ROBOTICS_CLASS = '55555555-5555-4555-8555-555555555555';
const ADA = '33333333-3333-4333-8333-333333333333';
const TIME_ZONE = 'Australia/Sydney';

// Robotics runs Monday 5 July 2027, 09:00 to 12:00 in Sydney. Painting, the class being booked, overlaps it.
const robotics = {
  sessionId: SESSION_ID,
  className: 'Robotics',
  classId: ROBOTICS_CLASS,
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
};
const parent: Session = {
  id: SESSION_ID,
  name: 'Summer camp',
  description: '',
  startsOn: '2027-07-01',
  endsOn: '2027-07-14',
  classCount: 2,
  isPublic: false,
  createdAt: '2027-07-01T00:00:00.000Z',
};
const painting: Class = {
  id: PAINTING_CLASS,
  sessionId: SESSION_ID,
  sessionName: 'Summer camp',
  name: 'Painting',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 12,
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Studio 2',
  instructorIds: [],
  instructors: [],
  seatsTaken: 0,
  waitlisted: 0,
  price: null,
};

const render = (node: ReactNode) => renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>);

const enrolForm = (intent: 'enrol' | 'waitlist') => {
  const form = new FormData();
  form.set('classId', PAINTING_CLASS);
  form.set('camperId', ADA);
  form.set('intent', intent);

  return form;
};

beforeEach(() => {
  vi.clearAllMocks();
  session.role = 'staff';
  notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  services.orgs.getCamp.mockResolvedValue({ timezone: TIME_ZONE });
  services.classes.listTeacherAssignments.mockResolvedValue({ ok: true, value: [] });
  services.orgs.listMembers.mockResolvedValue({ members: [] });
  services.classes.getSession.mockResolvedValue({ ok: true, value: parent });
  services.classes.getClass.mockResolvedValue({ ok: true, value: painting });
  services.classes.listClasses.mockResolvedValue({ ok: true, value: [painting] });
  services.classes.listSessions.mockResolvedValue({ ok: true, value: [parent] });
  services.classes.listEnrolments.mockResolvedValue({ ok: true, value: [] });
  // The service refuses the clash; `attempt` turns the refusal into the outcome the composer reads.
  services.classes.enrol.mockImplementation(() =>
    attempt(() => Promise.reject(refusalError({ kind: 'refuse', reason: 'overlap', clash: robotics })), TIME_ZONE),
  );
  services.people.list.mockResolvedValue([{ id: ADA, givenName: 'Ada', familyName: 'Lovelace', roles: ['camper'] }]);
});

describe('blocked overlap, in the enrolment UI', () => {
  it('names the clashing class and its time', async () => {
    const state = await enrolAction(idle, enrolForm('enrol'));
    expect(state.status).toBe('error');
    const html = render(<ActionMessage state={state} />);
    expect(html).toContain('clashes with Robotics');
    expect(html).toContain('role="alert"');
    expect(services.classes.enrol).toHaveBeenCalledTimes(1);
  });

  it('offers the override field to an admin', async () => {
    session.role = 'admin';
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: { class: PAINTING_CLASS } }));
    expect(html).toContain('Override reason (admins only)');
  });

  it('does not offer the override field to staff', async () => {
    const html = render(await ClassPage({ classId: SESSION_ID, searchParams: { class: PAINTING_CLASS } }));
    expect(html).toContain('Enrol camper');
    expect(html).not.toContain('Override reason');
  });
});
