import { classTemplateDownload } from '@/components/views/classes/export';
import { settle } from '@buxa/domain';

/** GET the blank import template as CSV. Staff with classes:manage only; the service checks it. */
export function GET(): Promise<Response> {
  return settle(() => {
    return classTemplateDownload();
  });
}
