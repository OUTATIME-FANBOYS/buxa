import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@buxa/contracts';
import { EditSessionForm } from '../EditSessionForm';

vi.mock('@/actions/classes', () => ({
  updateSessionAction: vi.fn(),
  previewSessionDatesAction: vi.fn(),
  deleteSessionAction: vi.fn(),
  deleteSessionsAction: vi.fn(),
}));

const session = (over: Partial<Session> = {}): Session => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Summer camp',
  description: '',
  startsOn: '2027-07-01',
  endsOn: '2027-07-14',
  classCount: 0,
  isPublic: false,
  status: 'live',
  archivedAt: null,
  createdAt: '2027-07-01T00:00:00.000Z',
  ...over,
});

describe('EditSessionForm: the public flag', () => {
  it('posts isPublic=on and shows the box ticked when the session is public', () => {
    const html = renderToStaticMarkup(
      <EditSessionForm
        session={session({ isPublic: true })}
        formId="edit"
        onPendingChange={() => undefined}
        onSaved={() => undefined}
      />,
    );
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*name="isPublic"[^>]*checked/);
    expect(html).toMatch(/name="isPublic"[^>]*value="on"/);
  });

  it('shows the box unticked when the session is not public', () => {
    const html = renderToStaticMarkup(
      <EditSessionForm session={session()} formId="edit" onPendingChange={() => undefined} onSaved={() => undefined} />,
    );
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*name="isPublic"[^>]*value="on"/);
    expect(html).not.toMatch(/name="isPublic"[^>]*checked/);
  });
});
