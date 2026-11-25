import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttendanceEntry, PersonSummary } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import type { OnSiteEntry } from '@buxa/server/services/attendance/AttendanceService';
import type { LogFilterChoices } from '@buxa/shared/attendance/types';
import { settle } from '@buxa/domain';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
const session = vi.hoisted(() => ({ camp: true, role: 'staff', timeZone: 'Asia/Kolkata' }));
const services = vi.hoisted(() => ({
  orgs: { getCamp: vi.fn() },
  attendance: {
    onSite: vi.fn(),
    log: vi.fn(),
    checkIn: vi.fn(),
    checkOut: vi.fn(),
    exportCsv: vi.fn(),
    checkInSessions: vi.fn(() => Promise.resolve([])),
    filterChoices: vi.fn((): Promise<LogFilterChoices> => Promise.resolve({ sessions: [], classes: [], staff: [] })),
  },
  people: { list: vi.fn() },
  credentials: { scan: vi.fn() },
}));

vi.mock('next/navigation', () => ({ notFound, useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock('@buxa/server/runtime', () => ({
  getRuntime: () => ({
    services,
    // A teacher's member options are read here (withMemberOptions): none are on.
    repositories: { users: { memberOptionsOf: () => Promise.resolve([]) } },
  }),
}));
vi.mock('@buxa/server/session/index', () => ({
  requireSession: () => settle(() => ({ user: { id: 'u1', email: 'a@example.test', name: 'Ada' }, memberships: [] })),
  getCurrentCamp: () =>
    settle(() => (session.camp ? { orgId: 'o1', role: session.role, name: 'Sunrise', slug: 'sunrise' } : null)),
  toActor: (_s: unknown, camp: { role: Role }) => ({ userId: 'u1', orgId: 'o1', role: camp.role }),
}));
vi.mock('@/components/components/scanner/ScanField', () => ({
  ScanField: ({ label }: { label: string }) => `SCAN:${label}`,
}));
vi.mock('@/components/components/scanner/CameraScanner', () => ({
  CameraScanner: () => 'CAMERA',
}));
vi.mock('@buxa/server/composers/attendance/searchPeople', () => ({
  searchPeopleAction: () => settle(() => ({ kind: 'ok', value: [] })),
}));
vi.mock('@buxa/server/composers/attendance/checkIn', () => ({
  checkInAction: () => settle(() => ({ kind: 'ok', value: { ok: false, reason: 'archived' } })),
}));
vi.mock('@buxa/server/composers/attendance/checkOut', () => ({
  checkOutAction: () => settle(() => ({ kind: 'ok', value: { ok: false, reason: 'not_on_site' } })),
}));

const { CheckInScreen } = await import('@/components/views/attendance');
const { OnSiteScreen } = await import('@/components/views/attendance');
const { AttendanceScreen } = await import('@/components/views/attendance');

const ada: PersonSummary = {
  id: '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f',
  givenName: 'Ada',
  familyName: 'Lovelace',
  roles: ['camper'],
  status: 'valid',
  onSite: true,
  archived: false,
};
const sam: PersonSummary = {
  ...ada,
  id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  givenName: 'Sam',
  familyName: 'Lee',
  roles: ['guardian'],
};
const onSiteEntry = (person: PersonSummary, checkedInAt: string, isMinor: boolean): OnSiteEntry => ({
  entry: { id: `e-${person.id}`, personId: person.id, personName: person.givenName, checkedInAt } as AttendanceEntry,
  person,
  isMinor,
  pickupOptions: [{ personId: sam.id, name: 'Sam Lee', relationship: 'Parent' }],
});

beforeEach(() => {
  vi.clearAllMocks();
  session.camp = true;
  session.role = 'staff';
  session.timeZone = 'Asia/Kolkata';
  services.orgs.getCamp.mockImplementation(() =>
    settle(() => ({
      id: 'o1',
      name: 'Sunrise',
      slug: 'sunrise',
      createdAt: '2026-03-04T10:00:00Z',
      memberCount: 2,
      timezone: session.timeZone,
    })),
  );
  services.people.list.mockResolvedValue([ada, sam]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CheckInScreen', () => {
  it('shows the console to someone who may record attendance', async () => {
    const html = renderToStaticMarkup(await CheckInScreen());
    expect(html).toContain('SCAN:Scan a badge, or type a code');
    expect(html).toContain('Find by name');
    expect(html).toContain('Scan with camera');
  });

  it('gives a viewer a friendly answer, not an error', async () => {
    session.role = 'viewer';
    const html = renderToStaticMarkup(await CheckInScreen());
    expect(html).toContain('Ask a staff member to check people in');
    expect(html).not.toContain('Find by name');
  });

  it('answers not-found with no camp', async () => {
    session.camp = false;
    await expect(CheckInScreen()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('OnSiteScreen', () => {
  it('lists who is on site with camp-local arrival times, marks minors and counts them', async () => {
    services.attendance.onSite.mockResolvedValue([
      onSiteEntry(ada, '2026-11-13T20:30:00Z', true), // 02:00 in Kolkata on the 14th
      onSiteEntry(sam, '2026-11-13T08:12:00Z', false), // 13:42
    ]);
    const html = renderToStaticMarkup(await OnSiteScreen());
    expect(html).toContain('2 people on site now');
    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Checked in: 02:00');
    expect(html).toContain('Checked in: 13:42');
    expect(html).toContain('Minor');
    expect(html.indexOf('Ada Lovelace')).toBeLessThan(html.indexOf('Sam Lee'));
    expect(html).toContain('>Check out<');
  });

  it('shows an empty state when nobody is on site', async () => {
    services.attendance.onSite.mockResolvedValue([]);
    const html = renderToStaticMarkup(await OnSiteScreen());
    expect(html).toContain('No one is on site');
    expect(html).toContain('0 people on site now');
  });

  it('shows a viewer a cannot-see state, not the list (no names, no check-out)', async () => {
    session.role = 'viewer';
    services.attendance.onSite.mockResolvedValue([onSiteEntry(ada, '2026-11-13T08:12:00Z', true)]);
    const html = renderToStaticMarkup(await OnSiteScreen());
    expect(html).toContain('You cannot see who is on site');
    expect(html).not.toContain('Ada Lovelace');
    expect(html).not.toContain('>Check out<');
    expect(services.attendance.onSite).not.toHaveBeenCalled();
  });
});

describe('AttendanceScreen', () => {
  it('links to the export section of the help page from the header', async () => {
    services.attendance.log.mockResolvedValue([]);
    const html = renderToStaticMarkup(await AttendanceScreen({ searchParams: {} }));
    expect(html).toContain('href="/camp/help#exports"');
    expect(html).toContain('>Help<');
  });

  it('passes the session, class, method, staff and status filters to the log, and shows the choices', async () => {
    const session = '7a2d3c9f-0b4e-4d6f-9a81-2b3c4d5e6f70';
    const cls = '8b3e4d0a-1c5f-4e70-8b92-3c4d5e6f7081';
    const staff = '9c4f5e1b-2d60-4f81-9ca3-4d5e6f708192';
    services.attendance.log.mockResolvedValue([]);
    services.attendance.filterChoices.mockResolvedValue({
      sessions: [{ id: session, name: 'Summer 1' }],
      classes: [{ id: cls, name: 'Swim Juniors', sessionId: session }],
      staff: [{ id: staff, name: 'Rosa Diaz' }],
    });
    const html = renderToStaticMarkup(
      await AttendanceScreen({
        searchParams: {
          from: '2026-11-10',
          to: '2026-11-12',
          sessionId: session,
          classId: cls,
          method: 'manual',
          checkedInBy: staff,
          status: 'checked_out',
        },
      }),
    );
    expect(services.attendance.log).toHaveBeenCalledWith(expect.anything(), {
      from: '2026-11-10',
      to: '2026-11-12',
      sessionId: session,
      classId: cls,
      method: 'manual',
      checkedInBy: staff,
      status: 'checked_out',
    });
    expect(html).toContain(`<option value="${session}" selected="">Summer 1</option>`);
    expect(html).toContain(`<option value="${staff}" selected="">Rosa Diaz</option>`);
  });

  it('shows the dates problem and no rows when the range runs backwards', async () => {
    const html = renderToStaticMarkup(
      await AttendanceScreen({ searchParams: { from: '2026-11-12', to: '2026-11-10' } }),
    );
    expect(html).toContain('The end date cannot be before the start date.');
    expect(services.attendance.log).not.toHaveBeenCalled();
  });

  it('defaults the dates to today in the camp zone, not the server zone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-13T20:30:00Z')); // already the 14th in Kolkata
    services.attendance.log.mockResolvedValue([]);
    const html = renderToStaticMarkup(await AttendanceScreen({ searchParams: {} }));
    expect(services.attendance.log).toHaveBeenCalledWith(expect.anything(), { from: '2026-11-14', to: '2026-11-14' });
    expect(html).toContain('value="2026-11-14"');
    expect(html).toContain('No visits for these days');
  });

  it('shows the log in camp time with names and the override reason', async () => {
    services.attendance.log.mockResolvedValue([
      {
        id: 'e1',
        personId: ada.id,
        personName: 'Ada Lovelace',
        checkedInAt: '2026-11-13T08:12:00Z',
        checkedInByName: 'Maya Chen',
        method: 'qr',
        checkedOutAt: null,
        checkedOutByName: null,
        collectedByName: null,
        overrideReason: 'Parent on the phone',
        note: null,
        sessionName: 'Summer 1',
        className: 'Swim Juniors',
      } satisfies AttendanceEntry,
    ]);
    const html = renderToStaticMarkup(
      await AttendanceScreen({ searchParams: { from: '2026-11-13', to: '2026-11-13' } }),
    );
    expect(html).toContain('13 Nov, 13:42');
    expect(html).toContain('Maya Chen');
    expect(html).toContain('Badge');
    expect(html).toContain('Parent on the phone');
    expect(html).toContain('On site');
    expect(html).toContain('Summer 1');
    expect(html).toContain('Swim Juniors');
  });

  it('offers the CSV download to a role with attendance:export only', async () => {
    services.attendance.log.mockResolvedValue([]);
    session.role = 'owner';
    // The button opens the column picker; the file itself is built from the filter when Download is pressed.
    expect(
      renderToStaticMarkup(await AttendanceScreen({ searchParams: { from: '2026-11-10', to: '2026-11-12' } })),
    ).toContain('>Download CSV</button>');
    session.role = 'staff';
    expect(
      renderToStaticMarkup(await AttendanceScreen({ searchParams: { from: '2026-11-10', to: '2026-11-12' } })),
    ).not.toContain('Download CSV');
  });

  it('explains a bad range and does not query the log', async () => {
    const html = renderToStaticMarkup(
      await AttendanceScreen({ searchParams: { from: '2026-11-12', to: '2026-11-10' } }),
    );
    expect(html).toContain('The end date cannot be before the start date.');
    expect(services.attendance.log).not.toHaveBeenCalled();
  });
});

describe('AttendanceScreen for a teacher', () => {
  it('keeps the camp-wide log from a teacher: no filter choices or rows are loaded', async () => {
    session.role = 'teacher';
    const html = renderToStaticMarkup(await AttendanceScreen({ searchParams: {} }));
    expect(html).toContain('You cannot see the attendance log');
    expect(services.attendance.filterChoices).not.toHaveBeenCalled();
    expect(services.attendance.log).not.toHaveBeenCalled();
  });
});
