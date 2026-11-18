import { describe, expect, it, vi } from 'vitest';
import { settle } from '@buxa/domain';

const response = new Response('report');
const classErrorReportResponse = vi.fn<(form: FormData) => Promise<Response>>(() => settle(() => response));
vi.mock('@buxa/server/composers/index.server', () => ({ classErrorReportResponse }));

const { POST } = await import('../../../../app/(app)/camp/(operations)/classes/import/error-report/route');

describe('POST /camp/classes/import/error-report', () => {
  it('hands the posted form to the composer and answers with its response unchanged', async () => {
    const body = new FormData();
    body.append('fileName', 'season.csv');
    body.append('csv', 'row');
    const request = new Request('http://localhost/camp/classes/import/error-report', { method: 'POST', body });

    expect(await POST(request)).toBe(response);
    const [form] = classErrorReportResponse.mock.calls[0] ?? [];
    if (!form) {
      throw new Error('the composer was not called');
    }
    expect(form.get('fileName')).toBe('season.csv');
    expect(form.get('csv')).toBe('row');
  });
});
