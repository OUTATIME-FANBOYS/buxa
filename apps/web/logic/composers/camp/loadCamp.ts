import 'server-only';
import type { Actor } from '@buxa/domain';
import { getRuntime } from '../../../server/runtime';

/** The camp's own record (its name and time zone). Every role may read the camp. */
export const loadCampProfile = (actor: Actor) => getRuntime().services.orgs.getCamp(actor);

/** The people who can use the camp, with their roles. */
export const loadMembers = (actor: Actor) => getRuntime().services.orgs.listMembers(actor);
