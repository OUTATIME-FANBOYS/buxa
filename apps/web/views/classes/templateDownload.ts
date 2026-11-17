import { classTemplateResponse } from '@/logic/composers/index.server';

/** The blank import template as a CSV download. Routes reach composers through this screens-layer function. */
export const classTemplateDownload = (): Promise<Response> => classTemplateResponse();
