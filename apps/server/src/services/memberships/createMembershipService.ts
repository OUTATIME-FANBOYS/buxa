import type { Actor } from '@buxa/domain';
import { assertAllowed } from '../../auth/authorize';
import { badRequest, notFound } from '../../http/errors';
import { campToday } from '../shared/campDay';
import { guard } from '../shared/errors';
import { campZone, toPersonMembership } from '../shared/views';
import type { MembershipService, MembershipServiceDeps } from './MembershipService';

export function createMembershipService(deps: MembershipServiceDeps): MembershipService {
  const { memberships, people, orgs, clock } = deps;

  const todayFor = async (actor: Pick<Actor, 'userId' | 'orgId'>) => campToday(clock, await campZone(orgs, actor));

  return {
    async add(actor, input) {
      assertAllowed(actor, 'memberships:manage');
      if (input.endsOn < input.startsOn) {
        throw badRequest('The end date cannot be before the start date.');
      }
      if (!(await people.get(actor.userId, actor.orgId, input.personId))) {
        throw notFound('Person not found');
      }
      const record = await guard(() =>
        memberships.add(actor, {
          personId: input.personId,
          plan: input.plan,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
        }),
      );

      return toPersonMembership(record, await todayFor(actor));
    },

    async revoke(actor, input) {
      assertAllowed(actor, 'memberships:manage');
      const reason = input.reason.trim();
      if (reason === '') {
        throw badRequest('Say why.');
      }
      const record = await guard(() => memberships.revoke(actor, input.membershipId, reason, clock().toISOString()));

      return toPersonMembership(record, await todayFor(actor));
    },

    async listFor(actor, personId) {
      assertAllowed(actor, 'people:read');
      if (!(await people.get(actor.userId, actor.orgId, personId))) {
        throw notFound('Person not found');
      }
      const today = await todayFor(actor);
      const records = await memberships.forPerson(actor.userId, actor.orgId, personId);

      return records.map(r => toPersonMembership(r, today));
    },
  };
}
