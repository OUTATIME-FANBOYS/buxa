import { can, credentialPayload, parseCredentialPayload, type Actor } from '@buxa/domain';
import { assertAllowed } from '../../auth/authorize';
import { isBadgeKeyError, type SealedToken } from '../../credentials/badgeCipher';
import { conflict, forbidden, HttpError, notFound } from '../../http/errors';
import { generateCredentialToken, hashCredentialToken } from '../../credentials/qrTokens';
import { campToday } from '../shared/campDay';
import { guard } from '../shared/errors';
import { campZone, toSummary } from '../shared/views';
import type { PeopleRepository, PersonRecord } from '../../people/PeopleRepository';
import { childIdsOf } from './badgeAccess';
import type {
  BadgeReveal,
  CredentialService,
  CredentialServiceDeps,
  ProfileBadge,
  ScanResult,
} from './CredentialService';

const UNKNOWN: ScanResult = { kind: 'unknown' };

/** The message for a server with no badge key. It names the setting, never its value. */
const NOT_CONFIGURED =
  'Badge encryption is not configured on this server (BADGE_ENCRYPTION_KEY). Badges cannot be issued or shown until it is set.';

/** Runs a cipher call. A missing or wrong-sized key is an operator problem, so the client gets a 503 that names no secret. */
function withBadgeKey<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (isBadgeKeyError(error)) {
      throw new HttpError(503, NOT_CONFIGURED);
    }
    throw error;
  }
}

/** The people linked to a signed-in user by email: their own records, and the children of any household they guard. */
async function linkedPeople(
  people: PeopleRepository,
  actor: Actor,
  viewerEmail: string,
): Promise<{ mine: PersonRecord[]; childIds: string[] }> {
  const mine = await people.byEmail(actor.userId, actor.orgId, viewerEmail);
  const childIds = new Set<string>();
  for (const self of mine) {
    const households = await people.householdsOf(actor.userId, actor.orgId, self.id);
    for (const childId of childIdsOf(self.id, households)) {
      childIds.add(childId);
    }
  }

  return { mine, childIds: [...childIds] };
}

export function createCredentialService(deps: CredentialServiceDeps): CredentialService {
  const { credentials, people, memberships, attendance, orgs, clock, cipher } = deps;

  const sealFor = (token: string): SealedToken => withBadgeKey(() => cipher.seal(token));

  /** Reads the active badge (audited with `action`), then opens its encrypted copy. */
  async function reveal(actor: Actor, personId: string, action: 'badge.view' | 'badge.reprint'): Promise<BadgeReveal> {
    const revealed = await guard(() => credentials.reveal(actor, personId, action));
    if (!revealed) {
      throw notFound('This person has no active badge.');
    }
    if (!revealed.sealed) {
      return { kind: 'reissue' };
    }
    const sealed = revealed.sealed;
    const token = withBadgeKey(() => cipher.open(sealed));

    return { kind: 'shown', payload: credentialPayload(token) };
  }

  return {
    async issue(actor, personId) {
      assertAllowed(actor, 'credentials:manage');
      const orgId = actor.orgId;
      const person = await people.get(actor.userId, orgId, personId);
      if (!person) {
        throw notFound('Person not found');
      }
      if (person.archivedAt !== null) {
        throw conflict('Archived people cannot have a badge.');
      }

      // The token exists only here and in the response, and in encrypted form in storage. Storage gets its hash for lookup.
      // The repository revokes any previous badge in the same step (and wipes its encrypted copy).
      const token = generateCredentialToken();
      const sealed = sealFor(token);
      const record = await guard(() =>
        credentials.issue(actor, personId, hashCredentialToken(token), clock().toISOString(), sealed),
      );

      return {
        credentialId: record.id,
        token,
        payload: credentialPayload(token),
        issuedAt: record.issuedAt,
      };
    },

    async revoke(actor, personId) {
      assertAllowed(actor, 'credentials:manage');
      if (!(await people.get(actor.userId, actor.orgId, personId))) {
        throw notFound('Person not found');
      }
      await guard(() => credentials.revoke(actor, personId, clock().toISOString()));
    },

    async show(actor, personId, viewerEmail) {
      if (!can(actor, 'credentials:manage')) {
        const { mine, childIds } = await linkedPeople(people, actor, viewerEmail);
        const allowed = mine.some(self => self.id === personId) || childIds.includes(personId);
        if (!allowed) {
          throw forbidden('You can only show your own badge, or the badge of a child in your household.');
        }
      }

      return reveal(actor, personId, 'badge.view');
    },

    async reprint(actor, personId) {
      assertAllowed(actor, 'credentials:manage');

      return reveal(actor, personId, 'badge.reprint');
    },

    async badgesFor(actor, viewerEmail) {
      const { mine, childIds } = await linkedPeople(people, actor, viewerEmail);
      const selfIds = new Set(mine.map(self => self.id));
      const childIdsOnly = childIds.filter(id => !selfIds.has(id));
      const ids = [...selfIds, ...childIdsOnly];
      if (ids.length === 0) {
        return [];
      }
      const [records, active] = await Promise.all([
        people.getMany(actor.userId, actor.orgId, ids),
        credentials.withActive(actor.userId, actor.orgId, ids),
      ]);
      const badges: ProfileBadge[] = records
        .filter(record => selfIds.has(record.id) || record.archivedAt === null)
        .map(record => ({
          personId: record.id,
          name: `${record.givenName} ${record.familyName}`,
          roles: record.roles,
          hasActiveBadge: active.has(record.id),
          self: selfIds.has(record.id),
        }));

      return badges.sort((a, b) => Number(b.self) - Number(a.self));
    },

    async scan(actor, raw) {
      // A scan is a check-in step: the people who record attendance may scan, nobody else.
      assertAllowed(actor, 'attendance:record');
      const orgId = actor.orgId;
      const token = parseCredentialPayload(raw);
      if (token === null) {
        return UNKNOWN;
      }

      const personId = await credentials.resolve(actor.userId, orgId, hashCredentialToken(token));
      if (personId === null) {
        return UNKNOWN;
      }
      const person = await people.get(actor.userId, orgId, personId);
      if (!person || person.archivedAt !== null) {
        return UNKNOWN;
      }

      const today = campToday(clock, await campZone(orgs, actor));
      const [ms, open] = await Promise.all([
        memberships.forPerson(actor.userId, orgId, personId),
        attendance.openFor(actor.userId, orgId, personId),
      ]);

      return { kind: 'person', person: toSummary(person, ms, open !== null, today, true) };
    },
  };
}
