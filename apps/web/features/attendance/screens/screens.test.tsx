import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttendanceEntry, PersonSummary } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import type { OnSiteEntry } from '@/server/services';

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
const session = vi.hoisted(() => ({ camp: true as boolean, role: 'staff' as Role, timeZone: 'Asia/Kolkata' }));
const services = vi.hoisted(() => ({
  orgs: { getCamp: vi.fn() },
  attendance: { onSite: vi.fn(), log: vi.fn(), checkIn: vi.fn(), checkOut: vi.fn(), exportCsv: vi.fn() },
  people: { list: vi.fn() },
  credentials: { scan: vi.fn() },
}));

vi.mock('next/navigation', () => ({ notFound, useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@/server/session', () => ({
  requireSession: async () => ({ user: { id: 'u1', email: 'a@example.test', name: 'Ada' }, memberships: [] }),
  getCurrentCamp: async () => (session.camp ? { orgId: 'o1', role: session.role, name: 'Sunrise', slug: 'sunrise' } : null),
  toActor: (_s: unknown, camp: { role: Role }) => ({ userId: 'u1', orgId: 'o1', role: camp.role }),
}));
vi.mock('@/features/scanner', () => ({
  ScanField: ({ label }: { label: string }) => `SCAN:${label}`,
  CameraScanner: () => 'CAMERA',
}));
vi.mock('../actions/searchPeople', () => ({ searchPeopleAction: async () => ({ kind: 'ok', value: [] }) }));
vi.mock('../actions/checkIn', () => ({ checkInAction: async () => ({ kind: 'ok', value: { ok: false, reason: 'archived' } }) }));
vi.mock('../actions/checkOut', () => ({ checkOutAction: async () => ({ kind: 'ok', value: { ok: false, reason: 'not_on_site' } }) }));

const { CheckInScreen } = await import('./CheckInScreen');
const { OnSiteScreen } = await import('./OnSiteScreen');
const { AttendanceScreen } = await import('./AttendanceScreen');

const ada: PersonSummary = { id: '6f1c2b8e-9a3d-4c5e-8f70-1a2b3c4d5e6f', givenName: 'Ada', familyName: 'Lovelace', preferredName: null, roles: ['camper'], status: 'valid', onSite: true, archived: false };
const sam: PersonSummary = { ...ada, id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', givenName: 'Sam', familyName: 'Lee', roles: ['guardian'] };
const onSiteEntry = (person: PersonSummary, checkedInAt: string, isMinor: boolean): OnSiteEntry => ({
  entry: { id: `e-${person.id}`, personId: person.id, personName: person.givenName, checkedInAt } as AttendanceEntry,
  person, isMinor, pickupOptions: [{ personId: sam.id, name: 'Sam Lee', relationship: 'Parent' }],
});

beforeEach(() => {
  vi.clearAllMocks();
  session.camp = true; session.role = 'staff'; session.timeZone = 'Asia/Kolkata';
  services.orgs.getCamp.mockImplementation(async () => ({ id: 'o1', name: 'Sunrise', slug: 'sunrise', createdAt: '2026-03-04T10:00:00Z', memberCount: 2, timezone: session.timeZone }));
  services.people.list.mockResolvedValue([ada, sam]);
});

afterEach(() => { vi.useRealTimers(); });

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
    expect(html).toContain('Arrived 02:00');
    expect(html).toContain('Arrived 13:42');
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

  it('hides check-out from a viewer, who can see the list only', async () => {
    session.role = 'viewer';
    services.attendance.onSite.mockResolvedValue([onSiteEntry(ada, '2026-11-13T08:12:00Z', true)]);
    const html = renderToStaticMarkup(await OnSiteScreen());
    expect(html).toContain('Ada Lovelace');
    expect(html).not.toContain('>Check out<');
  });
});

describe('AttendanceScreen', () => {
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
    services.attendance.log.mockResolvedValue([{
      id: 'e1', personId: ada.id, personName: 'Ada Lovelace', checkedInAt: '2026-11-13T08:12:00Z', checkedInByName: 'Maya Chen',
      method: 'qr', checkedOutAt: null, checkedOutByName: null, collectedByName: null, overrideReason: 'Parent on the phone', note: null,
    } satisfies AttendanceEntry]);
    const html = renderToStaticMarkup(await AttendanceScreen({ searchParams: { from: '2026-11-13', to: '2026-11-13' } }));
    expect(html).toContain('13 Nov, 13:42');
    expect(html).toContain('Maya Chen');
    expect(html).toContain('Badge');
    expect(html).toContain('Parent on the phone');
    expect(html).toContain('On site');
  });

  it('offers the CSV download to a role with attendance:export only', async () => {
    services.attendance.log.mockResolvedValue([]);
    session.role = 'owner';
    expect(renderToStaticMarkup(await AttendanceScreen({ searchParams: { from: '2026-11-10', to: '2026-11-12' } })))
      .toContain('/camp/attendance/export?from=2026-11-10&amp;to=2026-11-12');
    session.role = 'staff';
    expect(renderToStaticMarkup(await AttendanceScreen({ searchParams: { from: '2026-11-10', to: '2026-11-12' } })))
      .not.toContain('Download CSV');
  });

  it('explains a bad range and does not query the log', async () => {
    const html = renderToStaticMarkup(await AttendanceScreen({ searchParams: { from: '2026-11-12', to: '2026-11-10' } }));
    expect(html).toContain('The end date cannot be before the start date.');
    expect(services.attendance.log).not.toHaveBeenCalled();
  });
});
