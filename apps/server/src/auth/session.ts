import type { Membership, User } from '@buxa/contracts';

/**
 * A camp the person belongs to, with whether it is archived. An archived camp is read-only: `toActor` carries the flag and the
 * domain refuses every write while it is set.
 */
export type CampMembership = Membership & { archived: boolean };

/** Who is signed in on this request and which camps they belong to. */
export interface Session {
  readonly user: User;
  /** The camps the person can write in: active camps only. */
  readonly memberships: readonly Membership[];
  /** The archived camps the person belongs to. They open read-only; nothing can be written in them. Absent means none. */
  readonly archivedMemberships?: readonly Membership[];
}

/** Every camp the person can open: their active camps, then their archived ones (read-only). */
export function openableCamps(session: Session): CampMembership[] {
  return [
    ...session.memberships.map(m => ({ ...m, archived: false })),
    ...(session.archivedMemberships ?? []).map(m => ({ ...m, archived: true })),
  ];
}
