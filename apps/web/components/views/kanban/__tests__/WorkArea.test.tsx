import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The views export reaches the profile action, whose server module graph is not needed to render the client shell.
vi.mock('@/actions/account', () => ({ updateProfileAction: async () => ({ status: 'idle' }) }));

// next/dynamic resolves on the client only; the test checks the area is client-only and wraps the providers.
vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options: { ssr: boolean; loading: () => unknown }) => {
    const Area = (props: Record<string, unknown>) => (props.user ? options.loading() : null);

    return Object.assign(Area, { ssrOptions: options.ssr });
  },
}));

describe('WorkArea', () => {
  // The first import pulls in the whole views graph (HeroUI included), which is slower than the default 5s on a cold cache.
  it('is loaded on the client only, with a loading line', async () => {
    const { WorkArea } = await import('@/components/views/kanban/export');
    expect((WorkArea as unknown as { ssrOptions: boolean }).ssrOptions).toBe(false);
    expect(
      renderToStaticMarkup(
        <WorkArea user={{ id: 'u', name: 'U', email: 'u@x.io' }}>
          <p>x</p>
        </WorkArea>,
      ),
    ).toContain('Loading…');
  }, 30000);
});
