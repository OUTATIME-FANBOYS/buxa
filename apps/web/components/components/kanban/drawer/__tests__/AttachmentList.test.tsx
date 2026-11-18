import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildSeed } from '@buxa/shared';
import { type Task } from '@buxa/shared';
import { AttachmentList } from '@/components/components/kanban/drawer/export';

const h = vi.hoisted(() => ({ store: {} }));
vi.mock('@buxa/middleware/providers/store', () => ({ useStore: () => h.store }));
vi.mock('@buxa/middleware/hooks/useAttachmentUpload', () => ({ useAttachmentUpload: () => ({ busy: false, input: { current: null }, upload: () => undefined }) }));

const task = { ...buildSeed().tasks[0], attachments: [{ id: 'a-1', name: 'form.pdf', size: 2048, type: 'application/pdf', at: '2027-07-01T00:00:00.000Z' }] } as unknown as Task;

describe('AttachmentList', () => {
  it('lists each file with its size and a remove control for editors', () => {
    h.store = { actions: {} };
    const html = renderToStaticMarkup(<AttachmentList task={task} ro={false} />);
    expect(html).toContain('<span class="file-name">form.pdf</span>');
    expect(html).toContain('2 KB');
    expect(html).toContain('aria-label="Remove form.pdf"');
    expect(html).toContain('button--sm');
  });
  it('is read-only for viewers, and says so when there are no files', () => {
    h.store = { actions: {} };
    const html = renderToStaticMarkup(<AttachmentList task={{ ...task, attachments: [] }} ro />);
    expect(html).toContain('No files yet.');
    expect(html).not.toContain('Remove');
  });
});
