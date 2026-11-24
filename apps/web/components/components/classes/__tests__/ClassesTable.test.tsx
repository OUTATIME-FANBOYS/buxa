import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { describe, expect, it, vi } from 'vitest';
import type { Class } from '@buxa/contracts';
import { ClassesTable } from '@/components/components/classes';

vi.mock('@/actions/classes', () => ({ updateClassAction: vi.fn(), deleteClassAction: vi.fn() }));

const SESSION = '11111111-1111-4111-8111-111111111111';

const cls = (over: Partial<Class> = {}): Class => ({
  id: '22222222-2222-4222-8222-222222222222',
  sessionId: SESSION,
  sessionName: 'Summer camp',
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 12,
  startsAt: '2027-07-04T23:00:00.000Z',
  endsAt: '2027-07-05T02:00:00.000Z',
  location: 'Lab 1',
  instructorIds: ['33333333-3333-4333-8333-333333333333'],
  instructors: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Ana Ruiz' }],
  seatsTaken: 3,
  waitlisted: 0,
  price: null,
  ...over,
});

const NoDialog = () => null;
const render = (canManage: boolean, selectedId: string | null = null) =>
  renderToStaticMarkup(
    <UiProvider Dialog={NoDialog}>
      <ClassesTable
        sessionId={SESSION}
        sessionName="Summer camp"
        classes={[cls()]}
        timeZone="Australia/Sydney"
        clockFormat="24h"
        selectedId={selectedId}
        canManage={canManage}
        canEdit={canManage}
        instructors={[]}
      />
    </UiProvider>,
  );

describe('ClassesTable: the classes of one session', () => {
  it('shows each class its own price, and says so when a class has none', () => {
    const html = renderToStaticMarkup(
      <UiProvider Dialog={NoDialog}>
        <ClassesTable
          sessionId={SESSION}
          sessionName="Summer camp"
          classes={[
            cls({ price: { currency: 'USD', regularMinor: 45000, earlyBirdMinor: null, earlyBirdUntil: null } }),
            cls({ id: '44444444-4444-4444-8444-444444444444', name: 'Painting', price: null }),
          ]}
          timeZone="Australia/Sydney"
          clockFormat="24h"
          selectedId={null}
          canManage={false}
          canEdit={false}
          instructors={[]}
        />
      </UiProvider>,
    );
    expect(html).toContain('>Price<');
    expect(html).toContain('$450.00');
    expect(html).toContain('Not set');
  });

  it('shows the ages, the Camp Size, the time, location, instructors and seats of each class', () => {
    const html = render(false);
    expect(html).toContain('Camp Size');
    expect(html).toContain('8 to 12');
    expect(html).toContain('Lab 1');
    expect(html).toContain('Ana Ruiz');
    expect(html).toContain('>9 left<');
    expect(html).not.toContain('Instructor ratio');
  });

  it('links the enrolments of a class by its id, on the session page', () => {
    const html = render(false);
    expect(html).toContain(`/camp/sessions/${SESSION}?class=22222222-2222-4222-8222-222222222222#enrolments`);
    expect(html).toContain('aria-label="Enrolments for Robotics"');
    expect(html).toContain('title="Enrolments"');
  });

  it('offers Edit and Delete to staff only', () => {
    expect(render(true)).toContain('aria-label="Edit Robotics"');
    expect(render(true)).toContain('title="Edit class"');
    expect(render(true)).toContain('aria-label="Delete Robotics"');
    expect(render(true)).toContain('title="Delete class"');
    expect(render(true)).toContain('button--glass-danger');
    expect(render(false)).not.toContain('aria-label="Edit Robotics"');
    expect(render(false)).not.toContain('aria-label="Delete Robotics"');
  });
});
