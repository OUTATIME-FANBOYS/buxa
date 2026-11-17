import { describe, expect, it, vi } from 'vitest';

const response = new Response('template');
const classTemplateResponse = vi.fn(async () => response);
vi.mock('@/logic/composers/index.server', () => ({ classTemplateResponse }));

const { classTemplateDownload } = await import('../templateDownload');

describe('classTemplateDownload', () => {
  it('answers with the composer response unchanged', async () => {
    expect(await classTemplateDownload()).toBe(response);
    expect(classTemplateResponse).toHaveBeenCalledOnce();
  });
});
