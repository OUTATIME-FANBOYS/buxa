import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PublicSessionPage } from '@buxa/server/publicSessions/PublicSessionService';

const page = vi.hoisted(() => ({ value: null as PublicSessionPage | null }));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@buxa/server/runtime', () => ({
  getRuntime: () => ({ services: { publicSessions: { getPage: () => Promise.resolve(page.value) } } }),
}));

const { default: PublicSessionPageRoute } = await import('./page');

const SESSION = '33333333-3333-4333-8333-333333333333';
const base = {
  campName: 'Lakeside Camp',
  timeZone: 'Australia/Sydney',
  sessionName: 'Summer 2027',
  description: 'Two weeks in July.',
  startsOn: '2027-07-01',
  endsOn: '2027-07-31',
};

const render = async () =>
  renderToStaticMarkup(
    await PublicSessionPageRoute({ params: Promise.resolve({ slug: 'lakeside', sessionId: SESSION }) }),
  );

describe('the public session page: each class shows its own price', () => {
  it('shows the price beside a class that has one, and nothing for a class without one', async () => {
    page.value = {
      ...base,
      classes: [
        {
          name: 'Painting',
          ageRange: { minAge: 8, maxAge: 12 },
          location: 'Studio',
          startsAt: '2027-07-04T23:00:00.000Z',
          endsAt: '2027-07-05T02:00:00.000Z',
          price: { currency: 'USD', regularMinor: 45000, earlyBirdMinor: null, earlyBirdUntil: null },
        },
        {
          name: 'Pottery',
          ageRange: { minAge: 8, maxAge: 12 },
          location: 'Studio',
          startsAt: '2027-07-06T23:00:00.000Z',
          endsAt: '2027-07-07T02:00:00.000Z',
          price: null,
        },
      ],
    };
    const html = await render();
    expect(html).toContain('Ages 8 to 12 · $450.00');
    expect(html.match(/· \$450\.00/g)).toHaveLength(1);
    expect(html).not.toContain('Not set');
  });

  it('shows no price at the session level: the session is only its name, dates and description', async () => {
    page.value = { ...base, classes: [] };
    const html = await render();
    expect(html).toContain('Summer 2027');
    expect(html).toContain('No upcoming classes are scheduled.');
    expect(html).not.toContain('$');
  });
});
