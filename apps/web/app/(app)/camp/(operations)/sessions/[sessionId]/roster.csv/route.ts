import { isUuid } from '@buxa/domain';
import { rosterCsvResponse } from '@buxa/server/composers/index.server';
import { plainText } from '@buxa/shared';

/**
 * GET a session's roster as CSV (UTF-8 with a byte-order mark, as an attachment). The session must be in the signed-in camp: a
 * session from another camp answers 404. Permission is the roster read's (the Groups and Assign screens' read).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) {
    return plainText('That session was not found.', 404);
  }

  return rosterCsvResponse(sessionId);
}
