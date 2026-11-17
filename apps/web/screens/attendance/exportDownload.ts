import { attendanceExportResponse } from '@/logic/composers/index.server';

/** The CSV download's answer. Routes reach composers through this screens-layer function. */
export const attendanceExportDownload = (url: string): Promise<Response> => attendanceExportResponse(url);
