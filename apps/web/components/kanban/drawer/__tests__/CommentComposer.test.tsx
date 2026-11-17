import { Dialog as ConfirmDialog } from '@/components/Dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { CommentComposer } from '../CommentComposer';

const h = vi.hoisted(() => ({ store: {} as Record<string, unknown> }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));

describe('CommentComposer', () => {
  beforeEach(() => { h.store = { actions: { addComment: () => undefined } }; });

  it('is a labelled comment box that hints at mentions and the send shortcut, and cannot send yet', () => {
    const html = renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}><CommentComposer taskId="t-1" members={[]} /></UiProvider>);
    expect(html).toContain('aria-label="Write a comment"');
    expect(html).toContain('Use @ to mention');
    expect(html).toContain('⌘ Enter to send');
    expect(html).toMatch(/<button class="btn btn-primary btn-sm"[^>]*disabled=""/);
  });
});
