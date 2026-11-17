import { classErrorReportDownload } from '@/components/views/classes/export';

/**
 * POST the import's file text (from the preview form) and get the refused rows as CSV. A form post, so the browser downloads the file
 * without a page change. Staff with classes:manage only; the service checks it, so a viewer gets 403 and no report.
 */
export async function POST(request: Request): Promise<Response> {
  return classErrorReportDownload(await request.formData());
}
