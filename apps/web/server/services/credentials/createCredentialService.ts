import { credentialPayload, parseCredentialPayload } from '@buxa/domain';
import { assertAllowed } from '../../auth/authorize';
import { conflict, notFound } from '../../http/errors';
import { generateCredentialToken, hashCredentialToken } from '../../../lib/qr/tokens';
import { campToday } from '../shared/campDay';
import { guard } from '../shared/errors';
import { campZone, toSummary } from '../shared/views';
import type { CredentialService, CredentialServiceDeps, ScanResult } from './CredentialService';

const UNKNOWN: ScanResult = { kind: 'unknown' };

export function createCredentialService(deps: CredentialServiceDeps): CredentialService {
  const { credentials, people, memberships, attendance, orgs, clock } = deps;

  return {
    async issue(actor, personId) {
      assertAllowed(actor, 'credentials:manage');
      const orgId = actor.orgId;
      const person = await people.get(orgId, personId);
      if (!person) throw notFound('Person not found');
      if (person.archivedAt !== null) throw conflict('Archived people cannot have a badge.');

      // The token exists only here and in the response: storage gets its hash. The repository revokes any previous badge in the same step.
      const token = generateCredentialToken();
      const record = await guard(() => credentials.issue(actor, personId, hashCredentialToken(token), clock().toISOString()));
      return {
        credentialId: record.id,
        token,
        payload: credentialPayload(token),
        issuedAt: record.issuedAt,
      };
    },

    async revoke(actor, personId) {
      assertAllowed(actor, 'credentials:manage');
      if (!(await people.get(actor.orgId, personId))) throw notFound('Person not found');
      await guard(() => credentials.revoke(actor, personId, clock().toISOString()));
    },

    async scan(actor, raw) {
      assertAllowed(actor, 'attendance:read');
      const orgId = actor.orgId;
      const token = parseCredentialPayload(raw);
      if (token === null) return UNKNOWN;

      const personId = await credentials.resolve(orgId, hashCredentialToken(token));
      if (personId === null) return UNKNOWN;
      const person = await people.get(orgId, personId);
      if (!person || person.archivedAt !== null) return UNKNOWN;

      const today = campToday(clock, await campZone(orgs, orgId));
      const [ms, open] = await Promise.all([
        memberships.forPerson(orgId, personId),
        attendance.openFor(orgId, personId),
      ]);
      return { kind: 'person', person: toSummary(person, ms, open !== null, today) };
    },
  };
}
