import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@buxa/contracts';
import { SessionsTable } from '@/components/components/classes';

vi.mock('@/actions/classes', () => ({
  updateSessionAction: vi.fn(),
  deleteSessionAction: vi.fn(),
  deleteSessionsAction: vi.fn(),
}));

const session = (over: Partial<Session> = {}): Session => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Summer camp',
  description: '',
  startsOn: '2027-07-01',
  endsOn: '2027-07-14',
  classCount: 4,
  isPublic: false,
  createdAt: '2027-07-01T00:00:00.000Z',
  price: null,
  ...over,
});

describe('SessionsTable', () => {
  it('shows the session name, its date range and how many classes it holds', () => {
    const html = renderToStaticMarkup(<SessionsTable sessions={[session()]} canManage={false} />);
    expect(html).toContain('Summer camp');
    expect(html).toContain('2027-07-01 to 2027-07-14');
    expect(html).toContain('>4<');
    expect(html).toContain('href="/camp/sessions/11111111-1111-4111-8111-111111111111"');
  });

  it('says so when a session has no dates yet', () => {
    expect(
      renderToStaticMarkup(<SessionsTable sessions={[session({ startsOn: null, endsOn: null })]} canManage={false} />),
    ).toContain('Dates not set yet');
  });

  it('gives staff an Edit and a Delete icon button per row, and a checkbox per row with a select-all', () => {
    const html = renderToStaticMarkup(<SessionsTable sessions={[session()]} canManage />);
    expect(html).toContain('aria-label="Edit Summer camp"');
    expect(html).toContain('aria-label="Delete Summer camp"');
    expect(html).toContain('Select all sessions');
    expect(html).toContain('Select Summer camp');
    expect(html).toMatch(/<input[^>]*type="checkbox"/);
  });

  it('gives a viewer no checkbox, no edit and no delete', () => {
    const html = renderToStaticMarkup(<SessionsTable sessions={[session()]} canManage={false} />);
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('aria-label="Delete Summer camp"');
    expect(html).not.toContain('aria-label="Edit Summer camp"');
    expect(html).not.toContain('Select all sessions');
  });
});
