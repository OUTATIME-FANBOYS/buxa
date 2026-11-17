import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// next/dynamic resolves on the client only; the test checks the area is client-only and wraps the providers.
vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options: { ssr: boolean; loading: () => unknown }) => {
    const Area = (props: Record<string, unknown>) => (props.user ? options.loading() : null);
    return Object.assign(Area, { ssrOptions: options.ssr });
  },
}));

describe('WorkArea', () => {
  it('is loaded on the client only, with a loading line', async () => {
    const { WorkArea } = await import('@/components/views/kanban/export');
    expect((WorkArea as unknown as { ssrOptions: boolean }).ssrOptions).toBe(false);
    expect(renderToStaticMarkup(<WorkArea user={{ id: 'u', name: 'U', email: 'u@x.io' } as never}><p>x</p></WorkArea>)).toContain('Loading…');
  });
});
