import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/providers';
import { describe, expect, it, vi } from 'vitest';
import type { Series } from '@buxa/contracts';
import { ClassesTable } from '@/components/components/classes';

vi.mock('@/actions/classes', () => ({
  updateSeriesAction: vi.fn(),
  deleteSeriesAction: vi.fn(),
  cancelOccurrenceAction: vi.fn(),
  restoreOccurrenceAction: vi.fn(),
}));

const SESSION = '11111111-1111-4111-8111-111111111111';
const SERIES = '22222222-2222-4222-8222-222222222222';
const ANCHOR = '55555555-5555-4555-8555-555555555555';

const series = (over: Partial<Series> = {}): Series => ({
  id: SERIES,
  sessionId: SESSION,
  sessionName: 'Summer camp',
  name: 'Robotics',
  ageRange: { minAge: 8, maxAge: 12 },
  capacity: 12,
  location: 'Lab 1',
  weekdays: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '12:00',
  firstDay: '2027-07-05',
  lastDay: '2027-07-09',
  occurrenceCount: 5,
  activeOccurrenceCount: 5,
  anchorClassId: ANCHOR,
  instructorIds: ['33333333-3333-4333-8333-333333333333'],
  instructors: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Ana Ruiz' }],
  price: null,
  seatsTaken: 3,
  waitlisted: 0,
  ...over,
});

const NoDialog = () => null;
const render = (canManage: boolean, selectedId: string | null = null, rows: Series[] = [series()]) =>
  renderToStaticMarkup(
    <UiProvider Dialog={NoDialog}>
      <ClassesTable
        sessionId={SESSION}
        sessionName="Summer camp"
        series={rows}
        timeZone="Australia/Sydney"
        selectedId={selectedId}
        daysId={null}
        canManage={canManage}
        canEdit={canManage}
        instructors={[]}
      />
    </UiProvider>,
  );

describe('ClassesTable: one row per class series', () => {
  it('shows one row for a five-day series, with its days, times and places', () => {
    const html = render(false);
    expect(html.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr>/g)).toHaveLength(1);
    expect(html).toContain('Mon to Fri');
    expect(html).toContain('09:00 to 12:00');
    expect(html).toContain('8 to 12');
    expect(html).toContain('Lab 1');
    expect(html).toContain('Ana Ruiz');
    expect(html).toContain('Camp Size');
    expect(html).toContain('>9 left<');
  });

  it('shows the series price, or says there is none', () => {
    const priced = render(false, null, [
      series({ price: { currency: 'USD', regularMinor: 45000, earlyBirdMinor: null, earlyBirdUntil: null } }),
    ]);
    expect(priced).toContain('$450.00');
    expect(render(false)).toContain('Not set');
  });

  it('links the enrolments by the series anchor day, and the days by the series id', () => {
    const html = render(false);
    expect(html).toContain(`/camp/sessions/${SESSION}?class=${ANCHOR}#enrolments`);
    expect(html).toContain('aria-label="Enrolments for Robotics"');
    expect(html).toContain(`/camp/sessions/${SESSION}?days=${SERIES}#days`);
  });

  it('offers Edit and Delete for the series to staff only', () => {
    expect(render(true)).toContain('aria-label="Edit Robotics"');
    expect(render(true)).toContain('aria-label="Delete Robotics"');
    expect(render(false)).not.toContain('aria-label="Edit Robotics"');
    expect(render(false)).not.toContain('aria-label="Delete Robotics"');
  });
});
