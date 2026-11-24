import 'server-only';
import { downloadHeaders, plainText } from '@buxa/shared';
import { isUuid } from '@buxa/domain';
import { getRuntime } from '../../runtime';
import { currentActor } from '../people/camp';
import { isRegistrationError } from '../../registration/errors';
import { isHttpError } from '../../http/errors';
import type { FileDownload } from '../../registration/RegistrationRepository';

/*
 * The download routes for registration files. Each checks the signed-in user through the service (which checks the permission and
 * the form's sessions), and answers 404 for anything it will not show, with the same message for each reason.
 */

function fileResponse(file: FileDownload): Response {
  // A copy backed by an ArrayBuffer: a database Buffer is typed as a view on a shared buffer, which a Response does not accept.
  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    headers: downloadHeaders(file.contentType, file.name),
  });
}

function downloadError(error: unknown): Response {
  if (isRegistrationError(error, 'registration-file-not-found')) {
    return plainText('That file is not available.', 404);
  }
  if (isHttpError(error) && error.statusCode === 403) {
    return plainText('Your role cannot open this file.', 403);
  }
  console.error('registration file download failed', error);

  return plainText('Could not open the file.', 500);
}

/**
 * A form's attachment for the session the family is registering for. The service checks the form covers that session; a file of
 * another camp or form is not found.
 */
export async function formFileResponse(fileId: string, sessionId: string): Promise<Response> {
  const actor = await currentActor();
  if (!actor) {
    return plainText('Choose a camp first.', 404);
  }
  if (!isUuid(fileId) || !isUuid(sessionId)) {
    return plainText('That file is not available.', 404);
  }
  try {
    return fileResponse(await getRuntime().services.registration.downloadFormFile(actor, fileId, sessionId));
  } catch (error) {
    return downloadError(error);
  }
}

/** A document a family sent with a registration, for staff to open and check. */
export async function documentResponse(fileId: string): Promise<Response> {
  const actor = await currentActor();
  if (!actor) {
    return plainText('Choose a camp first.', 404);
  }
  if (!isUuid(fileId)) {
    return plainText('That file is not available.', 404);
  }
  try {
    return fileResponse(await getRuntime().services.registration.downloadDocument(actor, fileId));
  } catch (error) {
    return downloadError(error);
  }
}
