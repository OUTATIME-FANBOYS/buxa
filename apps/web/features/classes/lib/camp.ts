import 'server-only';
import type { Actor } from '@buxa/domain';
import { getRuntime } from '@/server/runtime';

/** The camp's IANA zone (orgs.timezone). Every class time is entered and shown in it, never in the server's or the browser's zone. */
export async function campZone(actor: Actor): Promise<string> {
  return (await getRuntime().services.orgs.getCamp(actor)).timezone;
}
