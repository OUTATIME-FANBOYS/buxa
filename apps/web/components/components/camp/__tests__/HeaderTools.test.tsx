import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NotificationItem } from '@buxa/shared';
import { HeaderTools } from '@/components/components/camp/HeaderTools';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));
vi.mock('@/actions/notifications', () => ({ markNotificationsRead: () => Promise.resolve() }));

const item = (id: string, readAt: string | null = null): NotificationItem => ({
  id,
  kind: 'registration',
  title: 'New registration',
  link: '/camp/registration',
  createdAt: '2027-07-10T09:00:00.000Z',
  readAt,
});

describe('HeaderTools: the header icons every page shows', () => {
  it('shows a Help icon that links to the help page, and a notifications bell', () => {
    const html = renderToStaticMarkup(<HeaderTools items={[]} unread={0} />);
    expect(html).toContain('aria-label="Help"');
    expect(html).toContain('href="/camp/help"');
    expect(html).toContain('aria-label="Notifications"');
  });

  it('uses the glass icon-button style for both', () => {
    const html = renderToStaticMarkup(<HeaderTools items={[]} unread={0} />);
    expect(html.match(/button--glass/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('button--icon-only');
  });

  it('counts the unread server notifications on the bell, and shows no count when none are unread', () => {
    const none = renderToStaticMarkup(<HeaderTools items={[item('a', '2027-07-10T10:00:00.000Z')]} unread={0} />);
    expect(none).not.toContain('class="badge"');

    const two = renderToStaticMarkup(<HeaderTools items={[item('a'), item('b')]} unread={2} />);
    expect(two).toContain('class="badge">2<');
    expect(two).toContain('2 need attention');
  });

  it('adds the workspace’s attention rows to the count', () => {
    const html = renderToStaticMarkup(
      <HeaderTools
        items={[]}
        unread={0}
        attention={[{ key: 't1', text: 'Due today', icon: 'clock', at: null, unread: true, onOpen: () => undefined }]}
      />,
    );
    expect(html).toContain('class="badge">1<');
  });
});
