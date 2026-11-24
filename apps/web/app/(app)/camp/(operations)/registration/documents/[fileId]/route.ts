import { documentResponse } from '@buxa/server/composers/index.server';

/** GET a document a family sent with a registration, as a download. The signed-in user needs registration:read; otherwise 403 or 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }): Promise<Response> {
  const { fileId } = await params;

  return documentResponse(fileId);
}
