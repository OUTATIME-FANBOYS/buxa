import 'server-only';
import { rosterCsv, rosterFileName, BYTE_ORDER_MARK, csvHeaders, plainText } from '@buxa/shared';
import { currentActor } from '../people/camp';
import { loadRoster } from './loadRoster';

/**
 * The CSV download of a session's roster. Permission is the roster load's (the same reads as the Groups and Assign screens). A
 * byte-order mark is written first so spreadsheet programs read accented names correctly.
 */
export async function rosterCsvResponse(sessionId: string): Promise<Response> {
  const actor = await currentActor();
  if (!actor) {
    return plainText('Choose a camp first.', 404);
  }
  const loaded = await loadRoster(actor, sessionId);
  if (!loaded.ok) {
    return loaded.reason === 'forbidden'
      ? plainText('Your role cannot export this roster.', 403)
      : plainText('That session was not found.', 404);
  }

  return new Response(`${BYTE_ORDER_MARK}${rosterCsv(loaded.value.roster)}`, {
    status: 200,
    headers: csvHeaders(rosterFileName(loaded.value.session.name)),
  });
}
