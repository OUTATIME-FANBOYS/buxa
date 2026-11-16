import { attendanceExportResponse } from '@/features/attendance/lib/exportResponse';

/** GET the attendance log as CSV for the filter in the query string. Session and attendance:export are checked by the service. */
export async function GET(request: Request): Promise<Response> {
  return attendanceExportResponse(request.url);
}
