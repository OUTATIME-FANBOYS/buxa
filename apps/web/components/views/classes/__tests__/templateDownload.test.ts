import { describe, expect, it, vi } from 'vitest';

const response = new Response('template');
const classTemplateResponse = vi.fn(async () => response);
vi.mock('@buxa/server/composers/index.server', () => ({ classTemplateResponse }));

const { classTemplateDownload } = await import('@/components/views/classes/export');

describe('classTemplateDownload', () => {
  it('answers with the composer response unchanged', async () => {
    expect(await classTemplateDownload()).toBe(response);
    expect(classTemplateResponse).toHaveBeenCalledOnce();
  });
});
