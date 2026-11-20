import type { Actor } from '@buxa/domain';
import type { ClassRepository } from './ClassRepository';

/*
 * The assigned-classes scope, worked out on the server. A teacher sees the campers enrolled in its classes and nothing else.
 * Services call teacherScopeOf once, then pass `assignedTo` into authorize() (see the Resource type in @buxa/domain) and filter
 * their lists with it. Other roles have no scope (null), so their behaviour does not change.
 */

/** The part of the class storage the scope needs. */
export type TeacherScopeSource = Pick<ClassRepository, 'assignedClassIds' | 'camperIdsIn'>;

export interface TeacherScope {
  readonly classIds: ReadonlySet<string>;
  /** The people with an enrolled place in one of the teacher's classes. */
  readonly camperIds: ReadonlySet<string>;
}

/** The scope for this actor, or null when the actor is not a teacher. */
export async function teacherScopeOf(source: TeacherScopeSource, actor: Actor): Promise<TeacherScope | null> {
  if (actor.role !== 'teacher') {
    return null;
  }
  const classIds = await source.assignedClassIds(actor.userId, actor.orgId, actor.userId);
  const camperIds = await source.camperIdsIn(actor.userId, actor.orgId, classIds);

  return { classIds: new Set(classIds), camperIds: new Set(camperIds) };
}

/** For authorize()'s `assignedToClass`: whether the person is one of the teacher's campers. Undefined when no scope applies. */
export const assignedTo = (scope: TeacherScope | null, personId: string): boolean | undefined =>
  scope === null ? undefined : scope.camperIds.has(personId);
