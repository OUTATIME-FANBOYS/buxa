import { describe, expect, it, vi } from 'vitest';
import { settle } from '@buxa/domain';

const templateResponse = new Response('class_name,starts_at\n', {
  status: 200,
  headers: { 'content-type': 'text/csv; charset=utf-8' },
});

const errorReportResponse = new Response('row,error\n', {
  status: 200,
  headers: { 'content-type': 'text/csv; charset=utf-8' },
});

const mocks = vi.hoisted(() => ({
  classTemplateDownload: vi.fn(() => settle(() => templateResponse)),
  classErrorReportDownload: vi.fn(() => settle(() => errorReportResponse)),
  isSameOriginPost: vi.fn(() => true),
}));

vi.mock('@/components/views/classes', () => ({
  classTemplateDownload: mocks.classTemplateDownload,
  classErrorReportDownload: mocks.classErrorReportDownload,
}));

vi.mock('@/config/sameOrigin', () => ({
  isSameOriginPost: mocks.isSameOriginPost,
}));

const { GET } = await import('../../../app/(app)/camp/(operations)/classes/import/template/route');
const { POST } = await import('../../../app/(app)/camp/(operations)/classes/import/error-report/route');

describe('classes import route handlers', () => {
  describe('GET /camp/classes/import/template', () => {
    it('returns the CSV template download response', async () => {
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/csv');
      expect(mocks.classTemplateDownload).toHaveBeenCalledOnce();
    });
  });

  describe('POST /camp/classes/import/error-report', () => {
    it('refuses requests that fail the same-origin check with 403', async () => {
      mocks.isSameOriginPost.mockReturnValueOnce(false);

      const request = new Request('http://localhost/camp/classes/import/error-report', {
        method: 'POST',
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
      expect(await response.text()).toContain('Download the report from the import page');
    });

    it('processes form data and returns error report when same-origin passes', async () => {
      mocks.isSameOriginPost.mockReturnValueOnce(true);

      const formData = new FormData();
      formData.set('file', 'test data');

      const request = new Request('http://localhost/camp/classes/import/error-report', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(mocks.classErrorReportDownload).toHaveBeenCalledOnce();
    });
  });
});
