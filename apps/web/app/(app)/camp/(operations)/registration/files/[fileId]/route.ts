import { formFileResponse } from '@buxa/server/composers/index.server';

/**
 * GET a form's attachment (a blank immunization form, say) for the session in `?session=`. The service checks the form covers that
 * session and that the signed-in user may take a registration; anything else answers 404. The file is sent as a download.
 */
export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }): Promise<Response> {
  const { fileId } = await params;
  const sessionId = new URL(request.url).searchParams.get('session') ?? '';

  return formFileResponse(fileId, sessionId);
}
