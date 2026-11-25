// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Assignment, Group, Room } from '@buxa/contracts';
import type { Role } from '@buxa/domain';
import { settle } from '@buxa/domain';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { Dialog as ConfirmDialog } from '@/components/components';
import { FormRefusal, RatioOverridePopUp } from '@/components/components/groups/AssignDialog';

// The groups and assign screens: they render for a staff member and a viewer, and a refusal shows as small polite text. Mocks follow
// blockedOverlap.test.tsx: the runtime and the signed-in actor are replaced, the rest is real.
const services = vi.hoisted(() => ({
  classes: { getSession: vi.fn() },
  groups: { listGroups: vi.fn(), listRooms: vi.fn(), listAssignments: vi.fn(), assign: vi.fn() },
  people: { list: vi.fn() },
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
vi.mock('@buxa/server/composers/people/camp', () => ({
  currentActor: () => settle(() => (session.role ? { userId: 'u1', orgId: 'o1', role: session.role } : null)),
}));
const { GroupsPage } = await import('@/components/views/groups/GroupsPage');
const { AssignPage } = await import('@/components/views/groups/AssignPage');

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const HAWKS = '22222222-2222-4222-8222-222222222222';
const LODGE = '33333333-3333-4333-8333-333333333333';
const ADA = '44444444-4444-4444-8444-444444444444';
const GRACE = '55555555-5555-4555-8555-555555555555';

const session_ = {
  id: SESSION_ID,
  name: 'Summer 1',
  description: '',
  startsOn: '2027-07-05',
  endsOn: '2027-07-17',
  classCount: 1,
  isPublic: false,
  createdAt: '2027-07-01T00:00:00.000Z',
  price: null,
};
const hawks: Group = {
  id: HAWKS,
  sessionId: SESSION_ID,
  name: 'Hawks',
  capacity: 4,
  ratioCampers: 4,
  ageRange: { minAge: 8, maxAge: 12 },
  campers: 1,
  staff: 1,
};
const lodge: Room = { id: LODGE, sessionId: SESSION_ID, name: 'Lodge 1', location: 'North', capacity: 6, campers: 1 };
const adaPlacement: Assignment = {
  id: '66666666-6666-4666-8666-666666666666',
  sessionId: SESSION_ID,
  personId: ADA,
  personName: 'Ada Lovelace',
  role: 'camper',
  groupId: HAWKS,
  roomId: LODGE,
  overrideReason: null,
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const render = (node: React.ReactNode) => renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}>{node}</UiProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  session.role = 'staff';
  notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  services.classes.getSession.mockResolvedValue({ ok: true, value: session_ });
  services.groups.listGroups.mockResolvedValue({ ok: true, value: [hawks] });
  services.groups.listRooms.mockResolvedValue({ ok: true, value: [lodge] });
  services.groups.listAssignments.mockResolvedValue({ ok: true, value: [adaPlacement] });
  services.people.list.mockImplementation((_actor: unknown, query: { role: string }) =>
    Promise.resolve(
      query.role === 'camper'
        ? [
            { id: ADA, givenName: 'Ada', familyName: 'Lovelace', roles: ['camper'] },
            { id: GRACE, givenName: 'Grace', familyName: 'Hopper', roles: ['camper'] },
          ]
        : [],
    ),
  );
});

describe('the groups page', () => {
  it('shows the groups and rooms, with the New and Edit controls to staff', async () => {
    const html = render(await GroupsPage({ sessionId: SESSION_ID }));

    expect(html).toContain('Hawks');
    expect(html).toContain('1 of 4');
    expect(html).toContain('1:4');
    expect(html).toContain('New group');
    expect(html).toContain('New room');
    expect(html).toContain('Edit');
  });

  it('shows the lists to a viewer with no controls to change them', async () => {
    session.role = 'viewer';
    const html = render(await GroupsPage({ sessionId: SESSION_ID }));

    expect(html).toContain('Hawks');
    expect(html).not.toContain('New group');
    expect(html).not.toContain('>Edit<');
  });
});

describe('the assign page', () => {
  it('shows each group with its members and the campers not placed yet', async () => {
    const html = render(await AssignPage({ sessionId: SESSION_ID }));

    expect(html).toContain('Ada Lovelace');
    expect(html).toContain('Campers not placed yet');
    expect(html).toContain('Grace Hopper');
  });

  it('offers the Place or move button to staff', async () => {
    const html = render(await AssignPage({ sessionId: SESSION_ID }));

    expect(html).toContain('Place or move');
  });

  it('shows the Unassign button on each member to staff only', async () => {
    const staffHtml = render(await AssignPage({ sessionId: SESSION_ID }));
    expect(staffHtml).toContain('aria-label="Unassign Ada Lovelace"');

    session.role = 'viewer';
    expect(render(await AssignPage({ sessionId: SESSION_ID }))).not.toContain('Unassign');

    session.role = 'teacher';
    expect(render(await AssignPage({ sessionId: SESSION_ID }))).not.toContain('Unassign');
  });

  it('lets a viewer see the board but not place anyone', async () => {
    session.role = 'viewer';
    const html = render(await AssignPage({ sessionId: SESSION_ID }));

    expect(html).toContain('Ada Lovelace');
    expect(html).not.toContain('Place or move');
    expect(html).toContain('Only staff can place or move people.');
  });
});

describe('refusals and the ratio override', () => {
  it('shows a refusal as small polite text under the form', () => {
    const html = render(<FormRefusal state={{ status: 'error', message: 'This group is full (4 campers).' }} />);

    expect(html).toContain('This group is full (4 campers).');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('field-error');
  });

  it('shows no refusal text for a ratio refusal, which the override pop-up carries', () => {
    const html = renderToStaticMarkup(
      <FormRefusal
        state={{
          status: 'error',
          message: 'This group would have 5 campers for 1 staff.',
          fieldErrors: { ratio: 'This group would have 5 campers for 1 staff.' },
        }}
      />,
    );

    expect(html).toBe('');
  });

  it('asks an admin for a reason in a pop-up, and requires it', () => {
    // A pop-up is drawn into the page body (a portal), so this one is rendered into a real document.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <UiProvider Dialog={ConfirmDialog}>
          <RatioOverridePopUp
            selection={{ role: 'camper', personId: ADA, groupId: HAWKS, roomId: LODGE }}
            sessionId={SESSION_ID}
            message="This group would have 5 campers for 1 staff."
            onCancel={() => undefined}
            onDone={() => undefined}
          />
        </UiProvider>,
      );
    });

    const text = document.body.textContent ?? '';
    expect(text).toContain('Override the staff ratio');
    expect(text).toContain('Reason for the override');
    expect(text).toContain('This group would have 5 campers for 1 staff.');
    expect(text).toContain('Place with override');
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
