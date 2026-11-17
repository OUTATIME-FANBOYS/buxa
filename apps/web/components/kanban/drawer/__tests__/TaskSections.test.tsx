import { Dialog as ConfirmDialog } from '@/components/Dialog';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { UiProvider } from '@buxa/middleware/providers/UiProvider';
import { TaskSections } from '../TaskSections';

vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => ({ actions: {} }) }));
vi.mock('@buxa/middleware/hooks/useAttachmentUpload', () => ({ useAttachmentUpload: () => ({ busy: false, input: { current: null }, upload: () => undefined }) }));

describe('TaskSections', () => {
  it('shows subtasks, attachments and the discussion, in that order, below a saved task', () => {
    const seed = buildSeed();
    const html = renderToStaticMarkup(<UiProvider Dialog={ConfirmDialog}><TaskSections task={seed.tasks[0]} ro={false} members={[]} userById={() => undefined} /></UiProvider>);
    const order = ['>Subtasks</h3>', '>Attachments</h3>', 'role="tablist"'].map((s) => html.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });
});
