import { classErrorReportDownload } from '@/components/views/classes/export';
import { isSameOriginPost } from '@/config/sameOrigin';

/**
 * POST the import's file text (from the preview form) and get the refused rows as CSV. A form post, so the browser downloads the file
 * without a page change. Staff with classes:manage only; the service checks it, so a viewer gets 403 and no report.
 * The Origin must be this app's own: a POST from another site, or one with no Origin, is refused before the body is read.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginPost(request)) {
    return new Response('Download the report from the import page.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  return classErrorReportDownload(await request.formData());
}
