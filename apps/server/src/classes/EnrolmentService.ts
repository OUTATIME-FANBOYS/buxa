import { can, decideEnrolment, formatClash, toLocalDate, type Actor } from '@buxa/domain';
import type { CancelEnrolmentInput, Enrolment, EnrolInput } from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { ClassRepository, EnrolmentRule } from './ClassRepository';
import type { ClassServiceDeps } from './ClassService';
import { attempt, type Failure, type Outcome } from './outcome';

/** The enrolment and cancellation methods. The rule runs inside the repository's transaction; this file only supplies it. */
export function createEnrolmentMethods({ repo, timezoneOf }: ClassServiceDeps): {
  enrol(actor: Actor, input: EnrolInput): Promise<Outcome<Enrolment>>;
  cancelEnrolment(actor: Actor, input: CancelEnrolmentInput): Promise<Outcome<Enrolment>>;
} {
  return {
    async enrol(actor, input) {
      assertAllowed(actor, 'classes:manage');
      const timeZone = await timezoneOf(actor);
      const rule = enrolmentRule({ actor, input, timeZone });

      const result = await attempt(
        () => repo.enrol(actor, { classId: input.classId, camperId: input.camperId }, rule),
        timeZone,
      );
      if (result.ok) {
        return result;
      }

      return {
        ok: false,
        failure: await readableEnrolmentFailure(repo, actor, input.classId, input.camperId, result.failure, timeZone),
      };
    },

    async cancelEnrolment(actor, input) {
      assertAllowed(actor, 'classes:manage');

      return attempt(() => repo.cancelEnrolment(actor, input.enrolmentId, input.note ?? null), await timezoneOf(actor));
    },
  };
}

/**
 * The screen's words for a refused enrolment, with the names: "Mia is already enrolled in Art Camp", "Art Camp is full", and
 * "Mia is already in another class at this time: Swim Stars". The series is named by the day the enrolment was made against.
 */
async function readableEnrolmentFailure(
  repo: ClassRepository,
  actor: Actor,
  classId: string,
  camperId: string,
  failure: Failure,
  timeZone: string,
): Promise<Failure> {
  const named =
    failure.reason === 'already_enrolled' || failure.reason === 'session_full' || failure.reason === 'overlap';
  if (!named) {
    return failure;
  }
  const [cls, camper] = await Promise.all([
    repo.getClass(actor.userId, actor.orgId, classId),
    repo.camperNameOf(actor.userId, actor.orgId, camperId),
  ]);
  const series = cls?.name ?? 'This class';
  const who = camper ?? 'This camper';
  if (failure.reason === 'already_enrolled') {
    return { ...failure, message: `${who} is already enrolled in ${series}` };
  }
  if (failure.reason === 'session_full') {
    return { ...failure, message: `${series} is full. The camper can be put on the waitlist instead.` };
  }
  if (failure.refusal?.reason === 'overlap') {
    const clash = failure.refusal.clash;

    return {
      ...failure,
      message: `${who} is already in another class at this time: ${clash.className} (${formatClash(clash, timeZone)})`,
    };
  }

  return { ...failure, message: `${who} is already in another class at this time.` };
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
