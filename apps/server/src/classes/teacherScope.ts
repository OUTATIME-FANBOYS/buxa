import { isTeachingView, teachingScopeOf, type Actor, type TeachingScope } from '@buxa/domain';
import type { ClassRepository } from './ClassRepository';

/*
 * The assigned-classes scope, worked out on the server. A teacher sees the campers enrolled in its classes and nothing else.
 * Services call teacherScopeOf once, then pass `assignedTo` into authorize() (see the Resource type in @buxa/domain) and filter
 * their lists with it. Other roles have no scope (null), so their behaviour does not change.
 */

/** The part of the class storage the scope needs. */
export type TeacherScopeSource = Pick<ClassRepository, 'assignedClassIds' | 'camperIdsIn' | 'getClass'>;

export interface TeacherScope {
  readonly classIds: ReadonlySet<string>;
  /** The people with an enrolled place in one of the teacher's classes. */
  readonly camperIds: ReadonlySet<string>;
  /** The sessions and classes (series) the teacher teaches, by the teaching rule in @buxa/domain (My classes uses the same rule). */
  readonly teaching: TeachingScope;
}

/** The scope for this actor, or null when the actor is not in the teaching view (a viewer whose person is an instructor). */
export async function teacherScopeOf(source: TeacherScopeSource, actor: Actor): Promise<TeacherScope | null> {
  if (!isTeachingView(actor)) {
    return null;
  }
  const classIds = await source.assignedClassIds(actor.userId, actor.orgId, actor.userId);
  const camperIds = await source.camperIdsIn(actor.userId, actor.orgId, classIds);
  const days = await Promise.all(classIds.map(id => source.getClass(actor.userId, actor.orgId, id)));
  const teaching = teachingScopeOf(days.flatMap(day => (day ? [day] : [])));

  return { classIds: new Set(classIds), camperIds: new Set(camperIds), teaching };
}

/** For authorize()'s `assignedToClass`: whether the person is one of the teacher's campers. Undefined when no scope applies. */
export const assignedTo = (scope: TeacherScope | null, personId: string): boolean | undefined =>
  scope === null ? undefined : scope.camperIds.has(personId);
