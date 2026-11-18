import { attendanceExportDownload } from '@/components/views/attendance/export';
import { settle } from '@buxa/domain';

/** GET the attendance log as CSV for the filter in the query string. Session and attendance:export are checked by the service. */
export function GET(request: Request): Promise<Response> {
  return settle(() => {
    return attendanceExportDownload(request.url);
  });
}
