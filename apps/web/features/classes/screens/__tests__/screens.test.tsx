import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Class, Enrolment, PersonSummary, Session } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import { UiProvider } from '@/components/ui';
import { forbidden } from '@/server/http/errors';

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
const session = vi.hoisted(() => ({ role: 'staff' as Role | null }));
const services = vi.hoisted(() => ({
  classes: { listClasses: vi.fn(), getClass: vi.fn(), listSessions: vi.fn(), listEnrolments: vi.fn() },
  people: { list: vi.fn() },
  orgs: { getCamp: vi.fn() },
}));

vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn() }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@/features/people/lib/camp', () => ({
  currentActor: async () => (session.role ? { userId: 'u1', orgId: 'o1', role: session.role } : null),
}));

const { ClassList } = await import('../ClassList');
const { ClassPage } = await import('../ClassPage');
const { NewClass } = await import('../NewClass');
const { NewSession } = await import('../NewSession');
const { ImportClasses } = await import('../ImportClasses');

const CLASS_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const ADA = '33333333-3333-4333-8333-333333333333';

const cls: Class = {
  id: CLASS_ID, name: 'Robotics', description: 'Build and program small robots.', ageRange: { minAge: 8, maxAge: 12 },
  capacity: 12, instructorRatio: { instructors: 1, campers: 8 }, createdAt: '2027-07-01T00:00:00.000Z',
};
// Full: two places, both taken, and one on the waitlist. Monday 5 July 2027, 09:00 to 12:00 in Sydney.
const full: Session = {
  id: SESSION_ID, classId: CLASS_ID, className: 'Robotics', startsAt: '2027-07-04T23:00:00.000Z', endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Lab 1', instructorIds: [], capacity: 2, seatsTaken: 2, waitlisted: 1,
};
const enrolment: Enrolment = {
  id: '44444444-4444-4444-8444-444444444444', sessionId: SESSION_ID, classId: CLASS_ID, className: 'Robotics', camperId: ADA,
  camperName: 'Ada Lovelace', status: 'enrolled', enrolledAt: '2027-07-01T00:00:00.000Z', overrideReason: null,
};

const render = (node: ReactNode) => renderToStaticMarkup(<UiProvider>{node}</UiProvider>);
const asRole = (role: Role | null) => { session.role = role; };

beforeEach(() => {
  vi.clearAllMocks();
  notFound.mockImplementation(() => { throw new Error('NEXT_NOT_FOUND'); });
  asRole('staff');
  services.orgs.getCamp.mockResolvedValue({ timezone: 'Australia/Sydney' });
  services.classes.listClasses.mockResolvedValue({ ok: true, value: [cls] });
  services.classes.getClass.mockResolvedValue({ ok: true, value: cls });
  services.classes.listSessions.mockResolvedValue({ ok: true, value: [full] });
  services.classes.listEnrolments.mockResolvedValue({ ok: true, value: [enrolment] });
  services.people.list.mockResolvedValue([
    { id: ADA, givenName: 'Ada', familyName: 'Lovelace', roles: ['camper'] },
  ] as unknown as PersonSummary[]);
});

describe('ClassList', () => {
  it('shows the classes and, for staff, the create and import buttons', async () => {
    const html = render(await ClassList());
    expect(html).toContain('Robotics');
    expect(html).toContain('href="/camp/classes/new"');
    expect(html).toContain('href="/camp/classes/import"');
  });

  it('shows a viewer the classes with no create or import buttons', async () => {
    asRole('viewer');
    const html = render(await ClassList());
    expect(html).toContain('Robotics');
    expect(html).not.toContain('href="/camp/classes/new"');
    expect(html).not.toContain('href="/camp/classes/import"');
  });

  it('shows a forbidden state, not an error, when the service refuses the read', async () => {
    services.classes.listClasses.mockRejectedValue(forbidden('nope'));
    const html = render(await ClassList());
    expect(html).toContain('You cannot see classes');
  });
});

describe('ClassPage', () => {
  it('shows the class facts, and its sessions with enrolled, waitlisted and the full state', async () => {
    const html = render(await ClassPage({ classId: CLASS_ID, searchParams: {} }));
    expect(html).toContain('Build and program small robots.');
    expect(html).toContain('Full, with a waitlist');
    expect(html).toContain('5 Jul, 09:00');
  });

  it('offers only the waitlist for a full session, and explains why', async () => {
    const html = render(await ClassPage({ classId: CLASS_ID, searchParams: { session: SESSION_ID } }));
    expect(html).toContain('2 of 2 places taken, 1 on the waitlist.');
    expect(html).toContain('This session is full. A camper can join the waitlist instead.');
    expect(html).toContain('Add to waitlist');
    expect(html).not.toContain('Enrol camper');
  });

  it('lists the enrolled campers by name, with a cancel button for staff', async () => {
    const html = render(await ClassPage({ classId: CLASS_ID, searchParams: { session: SESSION_ID } }));
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Cancel enrolment');
  });

  it('gives a viewer the schedule and names, with no add, enrol or cancel controls', async () => {
    asRole('viewer');
    const html = render(await ClassPage({ classId: CLASS_ID, searchParams: { session: SESSION_ID } }));
    expect(html).toContain('Ada Lovelace');
    expect(html).not.toContain('href="/camp/classes/11111111-1111-4111-8111-111111111111/sessions/new"');
    expect(html).not.toContain('Add to waitlist');
    expect(html).not.toContain('Cancel enrolment');
  });

  it('says the viewer cannot see who is enrolled, when the service refuses the list', async () => {
    services.classes.listEnrolments.mockRejectedValue(forbidden('nope'));
    const html = render(await ClassPage({ classId: CLASS_ID, searchParams: { session: SESSION_ID } }));
    expect(html).toContain('You cannot see who is enrolled');
  });

  it('is not found when the class is not in this camp', async () => {
    services.classes.getClass.mockResolvedValue({ ok: false, failure: { reason: 'class_not_found', message: 'That class no longer exists.' } });
    await expect(ClassPage({ classId: CLASS_ID, searchParams: {} })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('ignores a session id that is not one of this class\'s sessions', async () => {
    const html = render(await ClassPage({ classId: CLASS_ID, searchParams: { session: '99999999-9999-4999-8999-999999999999' } }));
    expect(html).not.toContain('id="enrolments"');
  });
});

describe('NewClass (create a class)', () => {
  it('shows the form to staff', async () => {
    expect(render(await NewClass())).toContain('name="name"');
  });

  it('gives a viewer the forbidden state and no form', async () => {
    asRole('viewer');
    const html = render(await NewClass());
    expect(html).toContain('You cannot create classes');
    expect(html).not.toContain('name="name"');
    expect(html).not.toContain('Create class');
  });
});

describe('NewSession (add a session)', () => {
  it('shows the form to staff, with the class in its heading', async () => {
    const html = render(await NewSession({ classId: CLASS_ID }));
    expect(html).toContain('name="startsAt"');
    expect(html).toContain('A new session of Robotics.');
  });

  it('gives a viewer the forbidden state and no form', async () => {
    asRole('viewer');
    const html = render(await NewSession({ classId: CLASS_ID }));
    expect(html).toContain('You cannot add sessions');
    expect(html).not.toContain('name="startsAt"');
  });
});

describe('ImportClasses (bulk import)', () => {
  it('offers the template, the upload and the column list to staff', async () => {
    const html = render(await ImportClasses());
    expect(html).toContain('href="/camp/classes/import/template"');
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
