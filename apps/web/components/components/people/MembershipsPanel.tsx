import type { PersonMembership } from '@buxa/contracts';
import { AddMembershipForm } from '@/components/components/people/forms';
import { MembershipRow } from './MembershipRow';
import type { ClockFormat } from '@buxa/domain';

interface MembershipsPanelProps {
  personId: string;
  memberships: readonly PersonMembership[];
  canManage: boolean;
  timeZone: string;
  clockFormat: ClockFormat;
}

/** A person's memberships, newest first, each with its status in words. Only members of the camp who may manage memberships can change them. */
export function MembershipsPanel({ personId, memberships, canManage, timeZone, clockFormat }: MembershipsPanelProps) {
  return (
    <section className="panel" aria-labelledby="membership-heading">
      <h2 id="membership-heading" className="people-heading">
        Membership
      </h2>
      {memberships.length === 0 ? (
        <p className="muted">No membership yet. Attendance needs a valid membership.</p>
      ) : (
        <ul className="people-list" aria-label="Memberships">
          {memberships.map(m => (
            <MembershipRow
              key={m.id}
              membership={m}
              personId={personId}
              canManage={canManage}
              timeZone={timeZone}
              clockFormat={clockFormat}
            />
          ))}
        </ul>
      )}
      {canManage && <AddMembershipForm personId={personId} />}
    </section>
  );
}
