import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Session } from '@buxa/contracts';
import { SessionsTable } from '@/components/components/classes';

const session = (over: Partial<Session> = {}): Session => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Summer camp',
  description: '',
  startsOn: '2027-07-01',
  endsOn: '2027-07-14',
  classCount: 4,
  createdAt: '2027-07-01T00:00:00.000Z',
  ...over,
});

describe('SessionsTable', () => {
  it('shows the session name, its date range and how many classes it holds', () => {
    const html = renderToStaticMarkup(<SessionsTable sessions={[session()]} />);
    expect(html).toContain('Summer camp');
    expect(html).toContain('2027-07-01 to 2027-07-14');
    expect(html).toContain('>4<');
    expect(html).toContain('href="/camp/sessions/11111111-1111-4111-8111-111111111111"');
  });

  it('says so when a session has no dates yet', () => {
    expect(renderToStaticMarkup(<SessionsTable sessions={[session({ startsOn: null, endsOn: null })]} />)).toContain(
      'Dates not set yet',
    );
  });
});
