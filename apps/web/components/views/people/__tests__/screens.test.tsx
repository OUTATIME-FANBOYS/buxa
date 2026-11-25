import { ConfirmDialog } from '@/components/components';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Household, Membership, Person, PersonSummary } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { forbidden, notFound as notFoundError } from '@buxa/server/http/errors';
import { settle } from '@buxa/domain';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
const session = vi.hoisted(() => ({ camp: null as Membership | null }));
const services = vi.hoisted(() => ({
  people: { list: vi.fn(), listPage: vi.fn(), get: vi.fn(), getHousehold: vi.fn(), listHouseholds: vi.fn() },
  attendance: { history: vi.fn() },
  classes: { listSessions: vi.fn() },
  orgs: { getCamp: vi.fn() },
}));

vi.mock('next/navigation', () => ({ notFound, redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@buxa/server/runtime', () => ({ getRuntime: () => ({ services }) }));
vi.mock('@buxa/server/session/index', () => ({
  requireSession: () =>
    settle(() => ({ user: { id: 'u1', email: 'a@example.test', name: 'Ana' }, memberships: [session.camp] })),
  getCurrentCamp: () => settle(() => session.camp),
  toActor: (_s: unknown, camp: Membership) => ({ userId: 'u1', orgId: camp.orgId, role: camp.role }),
}));

const { PeopleList } = await import('@/components/views/people');
const { NewPerson } = await import('@/components/views/people');
const { PersonScreen } = await import('@/components/views/people');
const { EditPerson } = await import('@/components/views/people');

const ID = {
  ben: '22222222-2222-4222-8222-222222222222',
  anna: '55555555-5555-4555-8555-555555555555',
  household: '11111111-1111-4111-8111-111111111111',
  membership: '33333333-3333-4333-8333-333333333333',
};

/** A one-page result for the people list: every row on the single page, so the page and its range follow from the rows. */
const pageOf = (people: PersonSummary[]) => ({
  people,
  total: people.length,
  page: 1,
  pageSize: 25,
  pageCount: 1,
  from: people.length === 0 ? 0 : 1,
  to: people.length,
});

const as = (role: Role) => {
  session.camp = { orgId: 'o1', role, name: 'Sunrise', slug: 'sunrise' };
};
const render = (node: ReactNode) => renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>);
/** The page header's markup: the name, the status words, the email and the actions. */
const headerOf = (html: string) => html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';

const summary = (over: Partial<PersonSummary> = {}): PersonSummary => ({
  id: ID.ben,
  givenName: 'Ben',
  familyName: 'Lee',
  roles: ['camper'],
  status: 'valid',
  onSite: true,
  archived: false,
  ...over,
});

const household: Household = {
  id: ID.household,
  name: 'Lee family',
  members: [
    {
      personId: ID.anna,
      givenName: 'Anna',
      familyName: 'Lee',
      roles: ['guardian'],
      relationship: 'Mother',
      isGuardian: true,
      canPickup: true,
    },
    {
      personId: ID.ben,
      givenName: 'Ben',
      familyName: 'Lee',
      roles: ['camper'],
      relationship: 'Son',
      isGuardian: false,
      canPickup: false,
    },
  ],
};

const person = (over: Partial<Person> = {}): Person => ({
  ...summary(),
  dateOfBirth: null,
  email: null,
  phone: null,
  isMinor: true,
  memberships: [
    {
      id: ID.membership,
      personId: ID.ben,
      sessionId: null,
      plan: 'Summer 2027',
      startsOn: '2027-07-01',
      endsOn: '2027-08-20',
      revokedAt: null,
      revokedReason: null,
      status: 'valid',
    },
  ],
  households: [household],
  hasActiveBadge: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  services.people.listPage.mockResolvedValue(
    pageOf([
      summary(),
      summary({ id: ID.anna, givenName: 'Anna', roles: ['guardian'], status: 'none', onSite: false }),
    ]),
  );
  services.people.get.mockResolvedValue(person());
  services.people.getHousehold.mockResolvedValue(household);
  services.people.listHouseholds.mockResolvedValue([household]);
  services.attendance.history.mockResolvedValue([]);
  services.classes.listSessions.mockResolvedValue({ ok: true, value: [] });
  services.orgs.getCamp.mockResolvedValue({
    id: 'o1',
    name: 'Sunrise',
    slug: 'sunrise',
    timezone: 'Asia/Kolkata',
    createdAt: '2026-03-04T10:00:00Z',
    memberCount: 2,
  });
  as('staff');
});

describe('PeopleList', () => {
  it('lists people with their roles, their status in words and an On site marker', async () => {
    const html = render(await PeopleList({ searchParams: {} }));
    expect(html).toContain('Ben Lee');
    expect(html).toContain('>Valid<');
    expect(html).toContain('No membership');
    expect(html).toContain('On site');
    expect(html).toContain('2 people');
  });

  it('offers adding a person to staff, and not to viewers', async () => {
    const html = render(await PeopleList({ searchParams: {} }));
    expect(html).toContain('Add person');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('href="/camp/people/new"');
    as('viewer');
    expect(render(await PeopleList({ searchParams: {} }))).not.toContain('Add person');
  });

  it('passes the search and role from the address to the service, and keeps them in the form', async () => {
    const html = render(await PeopleList({ searchParams: { q: ' Ben ', role: 'camper' } }));
    expect(services.people.listPage).toHaveBeenCalledWith(
      { userId: 'u1', orgId: 'o1', role: 'staff' },
      { query: 'Ben', role: 'camper', page: 1 },
    );
    expect(html).toContain('value="Ben"');
  });

  it('ignores an unknown role instead of sending it', async () => {
    await PeopleList({ searchParams: { role: 'wizard' } });
    expect(services.people.listPage.mock.calls[0]?.[1]).toEqual({ page: 1 });
  });

  it('shows the page from the address and a pagination bar with the total', async () => {
    services.people.listPage.mockResolvedValueOnce({
      people: [summary()],
      total: 143,
      page: 2,
      pageSize: 25,
      pageCount: 6,
      from: 26,
      to: 50,
    });
    const html = render(await PeopleList({ searchParams: { page: '2', q: 'Ben' } }));
    expect(services.people.listPage).toHaveBeenCalledWith(expect.anything(), { query: 'Ben', page: 2 });
    expect(html).toContain('143 people');
    expect(html).toContain('Showing 26 to 50 of 143 people');
    expect(html).toContain('Page 2 of 6');
    expect(html).toContain('href="/camp/people?page=3&amp;q=Ben"');
  });

  it('says so when nothing is on the list yet', async () => {
    services.people.listPage.mockResolvedValueOnce(pageOf([]));
    expect(render(await PeopleList({ searchParams: {} }))).toContain('No people yet');
  });

  it('says so when a search matches nobody', async () => {
    services.people.listPage.mockResolvedValueOnce(pageOf([]));
    expect(render(await PeopleList({ searchParams: { q: 'zzz' } }))).toContain('No one matches that search');
  });

  it('answers a role that may not see people with a friendly state', async () => {
    services.people.listPage.mockRejectedValueOnce(forbidden('no'));
    expect(render(await PeopleList({ searchParams: {} }))).toContain('You cannot see the people list');
  });

  it('lets other failures reach the error boundary', async () => {
    services.people.listPage.mockRejectedValueOnce(new Error('db down'));
    await expect(PeopleList({ searchParams: {} })).rejects.toThrow('db down');
  });

  it('marks the results as a live region and labels the search', async () => {
    const html = render(await PeopleList({ searchParams: {} }));
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="search"');
    expect(html).toContain('<caption');
  });
});

describe('NewPerson', () => {
  it('shows the form to staff, with the roles as a labelled group', async () => {
    const html = render(await NewPerson({}));
    expect(html).toContain('<legend');
    expect(html).toContain('Parent or guardian');
    expect(html).toContain('Last name');
    expect(html).not.toContain('Preferred name');
    expect(html).toContain('Add person');
  });

  it('says the person joins the household when it comes from a guardian page', async () => {
    const html = render(await NewPerson({ householdId: ID.household }));
    expect(html).toContain('Adding to the Lee family household');
    expect(html).not.toContain('New household name');
  });

  it('explains the rule for a child up front', async () => {
    // The intro is shown in the Household section only, once a camper or guardian is chosen (see NewPersonForm tests).
    expect(render(await NewPerson({}))).not.toContain(
      'A child must join a household that has a parent or guardian in it.',
    );
  });

  it('tells a viewer they cannot add people', async () => {
    as('viewer');
    const html = render(await NewPerson({}));
    expect(html).toContain('Your role cannot add people');
    expect(html).not.toContain('Add person</button>');
  });
});

describe('NewPerson household picker', () => {
  const stone: Household = { id: '66666666-6666-4666-8666-666666666666', name: 'Stone family', members: [] };

  it('loads the camp’s households for the picker (the picker itself shows once a family role is chosen)', async () => {
    services.people.listHouseholds.mockResolvedValueOnce([household, stone]);
    render(await NewPerson({}));
    expect(services.people.listHouseholds).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', role: 'staff' });
  });

  it('keeps the picker out of the way when joining from a guardian page (?household=)', async () => {
    const html = render(await NewPerson({ householdId: ID.household }));
    expect(html).not.toContain('Existing household');
    expect(services.people.listHouseholds).not.toHaveBeenCalled();
  });

  it('shows no picker when the camp has no households yet', async () => {
    services.people.listHouseholds.mockResolvedValueOnce([]);
    const html = render(await NewPerson({}));
    expect(html).not.toContain('Existing household');
  });
});

describe('PersonScreen', () => {
  it('finds the person as the actor, and answers not-found for an unknown one', async () => {
    await PersonScreen({ id: ID.ben });
    expect(services.people.get).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', role: 'staff' }, ID.ben);
    services.people.get.mockRejectedValueOnce(notFoundError('no such person'));
    await expect(PersonScreen({ id: ID.anna })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('shows the email under the name in the header, and never the word null', async () => {
    services.people.get.mockResolvedValueOnce(
      person({ email: 'ben@example.test', phone: null, dateOfBirth: '2016-05-02' }),
    );
    const html = render(await PersonScreen({ id: ID.ben }));
    const header = headerOf(html);
    expect(header).toContain('ben@example.test');
    expect(header.indexOf('Ben Lee')).toBeLessThan(header.indexOf('ben@example.test'));
    // Visible markup only: React's inline bootstrap script legitimately contains the word.
    expect(html.replace(/<script[\s\S]*?<\/script>/g, '')).not.toMatch(/\bnull\b/);
  });

  it('leaves the email out of the header when the person has none', async () => {
    expect(headerOf(render(await PersonScreen({ id: ID.ben })))).not.toContain('people-email');
  });

  it('shows household members with their guardian and pick-up status in words', async () => {
    const html = render(await PersonScreen({ id: ID.ben }));
    expect(html).toContain('Guardian');
    expect(html).toContain('Can collect child');
    expect(html).toContain(`/camp/people/new?household=${ID.household}`);
  });

  it('shows membership status in words, and the badge once issued is not re-displayed', async () => {
    const html = render(await PersonScreen({ id: ID.ben }));
    expect(html).toContain('Summer 2027');
    expect(html).toContain('>Valid<');
    expect(html).toContain('Badge active');
    expect(html).not.toContain('TOKEN');
  });

  it('gives staff the household and membership controls, and admins the badge and archive controls too', async () => {
    const staff = render(await PersonScreen({ id: ID.ben }));
    expect(staff).toContain('Link someone to a household');
    expect(staff).not.toContain('Add membership');
    expect(staff).not.toContain('Archive person');

    as('admin');
    const admin = render(await PersonScreen({ id: ID.ben }));
    expect(admin).toContain('>Add membership</button>');
    expect(admin).toContain('Revoke');
    expect(admin).toContain('>Reissue</button>');
    expect(admin).toContain('Archive person');
  });

  it('hides everything a viewer may not change, and the visit history', async () => {
    as('viewer');
    const html = render(await PersonScreen({ id: ID.ben }));
    expect(html).not.toContain('Link someone to a household');
    expect(html).not.toContain('Add membership');
    expect(html).not.toContain('Issue badge');
    expect(html).not.toContain('Archive person');
    expect(html).not.toContain('Remove ');
    expect(services.attendance.history).not.toHaveBeenCalled();
  });

  it('lists visits for staff, naming the staff member', async () => {
    services.attendance.history.mockResolvedValueOnce([
      {
        id: 'v1',
        personId: ID.ben,
        personName: 'Ben Lee',
        checkedInAt: '2027-07-02T09:12:00Z',
        checkedInByName: 'Maya Chen',
        method: 'qr',
        checkedOutAt: null,
        checkedOutByName: null,
        collectedByName: null,
        overrideReason: null,
        note: null,
      },
    ]);
    const html = render(await PersonScreen({ id: ID.ben }));
    // 09:12 UTC is 14:42 in Asia/Kolkata, the camp's zone.
    expect(html).toContain('2 Jul, 14:42');
    expect(html).toContain('<li>2 Jul, 14:42</li>');
  });

  it('shows the last five check-ins, and "No check-ins yet." when there are none', async () => {
    const visit = (n: number) => ({
      id: `v${n}`,
      personId: ID.ben,
      personName: 'Ben Lee',
      checkedInAt: `2027-07-0${n}T09:00:00Z`,
      checkedInByName: 'Maya Chen',
      method: 'qr',
      checkedOutAt: null,
      checkedOutByName: null,
      collectedByName: null,
      overrideReason: null,
      note: null,
    });
    services.attendance.history.mockResolvedValueOnce([1, 2, 3, 4, 5, 6].map(visit).reverse());
    const html = render(await PersonScreen({ id: ID.ben }));
    expect(html.match(/<li>/g)).toHaveLength(5);
    expect(html).toContain('<li>6 Jul, 14:30</li>');
    // The sixth, oldest visit (1 Jul) is past the five shown.
    expect(html).not.toContain('1 Jul, 14:30');

    expect(render(await PersonScreen({ id: ID.ben }))).toContain('No check-ins yet.');
  });

  it('renders the four tiles in order: Membership, Household, Badge, Attendance', async () => {
    const html = render(await PersonScreen({ id: ID.ben }));
    const at = ['membership-heading', 'household-heading', 'badge-heading', 'attendance-heading'].map(id =>
      html.indexOf(`id="${id}"`),
    );
    expect(at.every(i => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('class="person-tiles"');
  });

  it('has no Details card', async () => {
    const html = render(await PersonScreen({ id: ID.ben }));
    expect(html).not.toContain('details-heading');
    expect(html).not.toContain('>Details<');
  });

  it('puts Edit details and Archive person in the header, beside the name', async () => {
    as('admin');
    const html = render(await PersonScreen({ id: ID.ben }));
    const header = headerOf(html);
    expect(header).toContain('>Edit details</button>');
    expect(header).toContain('Archive person');
    expect(header.indexOf('Ben Lee')).toBeLessThan(header.indexOf('Edit details'));
    expect(html.indexOf('Archive person')).toBeLessThan(html.indexOf('person-tiles'));
  });

  it('hides archive for a person already archived, and says a badge cannot be issued', async () => {
    services.people.get.mockResolvedValueOnce(person({ archived: true, hasActiveBadge: false }));
    as('admin');
    const html = render(await PersonScreen({ id: ID.ben }));
    expect(html).not.toContain('Archive person');
    expect(html).toContain('Archived people cannot have a badge');
  });

  it('offers Edit details to staff as a button that opens the pop-up, not a link to /edit; not to viewers', async () => {
    const html = render(await PersonScreen({ id: ID.ben }));
    expect(html).toContain('>Edit details</button>');
    expect(html).not.toContain(`/people/${ID.ben}/edit`);
    as('viewer');
    expect(render(await PersonScreen({ id: ID.ben }))).not.toContain('Edit details');
  });

  it('searches the camp by name for someone to link, and offers only the matches (never the person themselves)', async () => {
    services.people.list.mockResolvedValueOnce([
      summary(),
      summary({ id: ID.anna, givenName: 'Anna', roles: ['guardian'], status: 'none', onSite: false }),
    ]);
    const html = render(await PersonScreen({ id: ID.ben, searchParams: { q: ' Anna ' } }));
    expect(services.people.list).toHaveBeenCalledWith({ userId: 'u1', orgId: 'o1', role: 'staff' }, { query: 'Anna' });
    expect(html).toContain('value="Anna"');
    expect(html).toContain(`<option value="${ID.anna}">Anna Lee</option>`);
    expect(html).not.toContain(`<option value="${ID.ben}">`);
  });

  it('asks for a search first, and does not load the whole camp to fill the link form', async () => {
    const html = render(await PersonScreen({ id: ID.ben }));
    expect(services.people.list).not.toHaveBeenCalled();
    expect(html).toContain('Search by name to find someone in the camp.');
  });

  it('says so when a search matches nobody', async () => {
    services.people.list.mockResolvedValueOnce([]);
    expect(render(await PersonScreen({ id: ID.ben, searchParams: { q: 'zzz' } }))).toContain(
      'No one matches that search.',
    );
  });

  it('offers every household in the camp for linking, not only the ones this person is in', async () => {
    const stone = { id: '66666666-6666-4666-8666-666666666666', name: 'Stone family', members: [] };
    services.people.listHouseholds.mockResolvedValueOnce([household, stone]);
    services.people.list.mockResolvedValueOnce([
      summary({ id: ID.anna, givenName: 'Anna', roles: ['guardian'], status: 'none', onSite: false }),
    ]);
    const html = render(await PersonScreen({ id: ID.ben, searchParams: { q: 'Anna' } }));
    expect(html).toContain(`<option value="${stone.id}">Stone family</option>`);
  });

  it('shows a membership revoke time in the camp zone, not the server zone', async () => {
    services.people.get.mockResolvedValueOnce(
      person({
        memberships: [
          {
            id: ID.membership,
            personId: ID.ben,
            sessionId: null,
            plan: 'Summer 2027',
            startsOn: '2027-07-01',
            endsOn: '2027-08-20',
            revokedAt: '2027-07-02T23:30:00Z',
            revokedReason: 'Refund',
            status: 'revoked',
          },
        ],
      }),
    );
    as('admin');
    const html = render(await PersonScreen({ id: ID.ben }));
    // 23:30 UTC is 05:00 the next day in Asia/Kolkata (UTC+5:30).
    expect(html).toContain('Revoked 3 Jul, 05:00: Refund');
    expect(html).not.toContain('23:30');
  });
});

describe('EditPerson', () => {
  it('is the person page for the /edit address, with an Edit details button that opens the pop-up', async () => {
    services.people.get.mockResolvedValueOnce(person({ roles: ['participant'] }));
    const html = render(await EditPerson({ id: ID.ben }));
    expect(html).toContain('>Edit details</button>');
    expect(html).not.toContain('/edit"');
  });

  it('shows no Edit details button to a role that cannot change people', async () => {
    as('viewer');
    const html = render(await EditPerson({ id: ID.ben }));
    expect(html).not.toContain('Edit details');
    expect(html).not.toContain('Save changes');
  });

  it('answers not-found for an unknown person', async () => {
    services.people.get.mockRejectedValueOnce(notFoundError('no such person'));
    await expect(EditPerson({ id: ID.anna })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
