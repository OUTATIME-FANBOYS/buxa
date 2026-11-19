import { describe, expect, it, vi } from 'vitest';
import { settle } from '@buxa/domain';

const response = new Response('report');
const classErrorReportResponse = vi.fn<(form: FormData) => Promise<Response>>(() => settle(() => response));
vi.mock('@buxa/server/composers/index.server', () => ({ classErrorReportResponse }));

const { POST } = await import('../../../../app/(app)/camp/(operations)/sessions/import/error-report/route');

const URL_ = 'https://buxa.example/camp/sessions/import/error-report';

const formBody = (): FormData => {
  const body = new FormData();
  body.append('fileName', 'season.csv');
  body.append('csv', 'row');

  return body;
};

describe('POST /camp/sessions/import/error-report', () => {
  it('hands the posted form to the composer and answers with its response unchanged', async () => {
    const request = new Request(URL_, {
      method: 'POST',
      headers: { origin: 'https://buxa.example' },
      body: formBody(),
    });

    expect(await POST(request)).toBe(response);
    const [form] = classErrorReportResponse.mock.calls[0] ?? [];
    if (!form) {
      throw new Error('the composer was not called');
    }
    expect(form.get('fileName')).toBe('season.csv');
    expect(form.get('csv')).toBe('row');
  });

  it('refuses a cross-origin POST with 403 and never reads the body or calls the composer', async () => {
    classErrorReportResponse.mockClear();
    const request = new Request(URL_, {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
      body: formBody(),
    });

    const result = await POST(request);
    expect(result.status).toBe(403);
    expect(result.headers.get('Content-Disposition')).toBeNull();
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(classErrorReportResponse).not.toHaveBeenCalled();
  });

  it('refuses a POST with no Origin header with 403 and never calls the composer', async () => {
    classErrorReportResponse.mockClear();
    const request = new Request(URL_, { method: 'POST', body: formBody() });

    expect((await POST(request)).status).toBe(403);
    expect(classErrorReportResponse).not.toHaveBeenCalled();
  });
});
