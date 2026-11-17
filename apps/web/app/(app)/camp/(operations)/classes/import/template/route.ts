import { classTemplateDownload } from '@/views';

/** GET the blank import template as CSV. Staff with classes:manage only; the service checks it. */
export async function GET(): Promise<Response> {
  return classTemplateDownload();
}
