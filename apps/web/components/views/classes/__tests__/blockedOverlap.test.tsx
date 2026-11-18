import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Class, Session } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import { settle } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { Dialog as ConfirmDialog } from '@/components/components';
import { ActionMessage } from '@/components/components/classes/forms/ActionMessage';
import { idle } from '@buxa/shared';
import { attempt } from '@buxa/server/classes/outcome';
import { refusalError } from '@buxa/server/classes/errors';
import { enrolAction } from '@buxa/server/composers/classes/enrolAction';

// The blocked-overlap path end to end: the service refuses a clash, the outcome carries the clashing session, the composer
// hands its message to the form, and the form shows it. The override field is offered to admins only.

const services = vi.hoisted(() => ({
  classes: { enrol: vi.fn(), listClasses: vi.fn(), getClass: vi.fn(), listSessions: vi.fn(), listEnrolments: vi.fn() },
  people: { list: vi.fn() },
  orgs: { getCamp: vi.fn() },
}));
const session = vi.hoisted<{ role: Role | null }>(() => ({ role: 'staff' }));
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn() }));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@buxa/server/session/index', () => ({ requireSession: async () => ({ user: { clockFormat: null } }) }));
vi.mock('@buxa/server/composers/people/camp', () => ({
  currentActor: () => settle(() => (session.role ? { userId: 'u1', orgId: 'o1', role: session.role } : null)),
}));

const { ClassPage } = await import('@/components/views/classes');

const CLASS_ID = '11111111-1111-4111-8111-111111111111';
const PAINTING_SESSION = '22222222-2222-4222-8222-222222222222';
const ROBOTICS_SESSION = '55555555-5555-4555-8555-555555555555';
const ADA = '33333333-3333-4333-8333-333333333333';
const TIME_ZONE = 'Australia/Sydney';

// Robotics runs Monday 5 July 2027, 09:00 to 12:00 in Sydney. Painting, the session being booked, overlaps it.
const robotics = {
  sessionId: ROBOTICS_SESSION,
  className: 'Robotics',
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
};

const cls: Class = {
  id: CLASS_ID,
  name: 'Painting',
  description: 'Watercolour and oils.',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 12,
  instructorRatio: { instructors: 1, campers: 8 },
  createdAt: '2027-07-01T00:00:00.000Z',
};
const painting: Session = {
  id: PAINTING_SESSION,
  classId: CLASS_ID,
  className: 'Painting',
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Studio 2',
  instructorIds: [],
  instructors: [],
  capacity: 10,
  seatsTaken: 0,
  waitlisted: 0,
};

const render = (node: ReactNode) => renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>);

const enrolForm = (intent: 'enrol' | 'waitlist') => {
  const form = new FormData();
  form.set('classId', CLASS_ID);
  form.set('sessionId', PAINTING_SESSION);
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
  services.classes.getClass.mockResolvedValue({ ok: true, value: cls });
  services.classes.listSessions.mockResolvedValue({ ok: true, value: [painting] });
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
    expect(html).toContain(
      'This clashes with Robotics (Mon 5 Jul, 09:00-12:00), which the camper is already enrolled in.',
    );
    expect(html).toContain('role="alert"');
    expect(services.classes.enrol).toHaveBeenCalledTimes(1);
  });

  it('offers the override field to an admin', async () => {
    session.role = 'admin';
    const html = render(await ClassPage({ classId: CLASS_ID, searchParams: { session: PAINTING_SESSION } }));
    expect(html).toContain('Override reason (admins only)');
  });

  it('does not offer the override field to staff', async () => {
    session.role = 'staff';
    const html = render(await ClassPage({ classId: CLASS_ID, searchParams: { session: PAINTING_SESSION } }));
    expect(html).toContain('Enrol camper');
    expect(html).not.toContain('Override reason');
  });
});
