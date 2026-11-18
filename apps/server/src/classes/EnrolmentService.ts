import { can, decideEnrolment, toLocalDate, type Actor } from '@buxa/domain';
import type { CancelEnrolmentInput, Enrolment, EnrolInput } from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { EnrolmentRule } from './ClassRepository';
import type { ClassServiceDeps } from './ClassService';
import { attempt, type Outcome } from './outcome';

/** The enrolment and cancellation methods. The rule runs inside the repository's transaction; this file only supplies it. */
export function createEnrolmentMethods({ repo, timezoneOf }: ClassServiceDeps): {
  enrol(actor: Actor, input: EnrolInput): Promise<Outcome<Enrolment>>;
  cancelEnrolment(actor: Actor, input: CancelEnrolmentInput): Promise<Outcome<Enrolment>>;
} {
  return {
    async enrol(actor, input) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor.orgId);
      const rule = enrolmentRule({ actor, input, timeZone });

      return attempt(() => repo.enrol(actor, { sessionId: input.sessionId, camperId: input.camperId }, rule), timeZone);
    },

    async cancelEnrolment(actor, input) {
      assertAllowed(actor, 'classes:manage');

      return attempt(
        () => repo.cancelEnrolment(actor, input.enrolmentId, input.note ?? null),
        await timezoneOf(actor.orgId),
      );
    },
  };
}

/** Binds the domain rule to this request: the actor's override permission, the waitlist choice and the camp's day. */
function enrolmentRule({
  actor,
  input,
  timeZone,
}: {
  actor: Actor;
  input: EnrolInput;
  timeZone: string;
}): EnrolmentRule {
  return facts =>
    decideEnrolment(
      { ...facts, sessionDay: toLocalDate(new Date(facts.session.startsAt), timeZone) },
      {
        waitlistIfFull: input.waitlistIfFull,
        override: input.override ?? null,
        actorCanOverride: can(actor, 'attendance:override'),
      },
    );
}
