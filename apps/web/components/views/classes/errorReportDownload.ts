import { classErrorReportResponse } from '@buxa/server/composers/index.server';

/** The refused rows of an uploaded file as a CSV download. Routes reach composers through this screens-layer function. */
export const classErrorReportDownload = (form: FormData): Promise<Response> => classErrorReportResponse(form);
