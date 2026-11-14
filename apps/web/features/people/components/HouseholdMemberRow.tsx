import Link from 'next/link';
import type { HouseholdMember } from '@buxa/contracts';
import { Pill } from '@/components/ui';
import { personPath } from '@/config/routes';
import { UnlinkButton } from '../forms/UnlinkButton';

/** One member of a household, with the two facts that decide pick-up, as words. */
export function HouseholdMemberRow({ member, householdId, canUpdate }: { member: HouseholdMember; householdId: string; canUpdate: boolean }) {
  const name = `${member.givenName} ${member.familyName}`;
  return (
    <li className="people-member">
      <div className="people-member-main">
        <Link href={personPath(member.personId)} className="row-title">{name}</Link>
        <span className="muted">{member.relationship}</span>
      </div>
      <div className="row">
        {member.isGuardian && <Pill tone="brand">Guardian</Pill>}
        {member.canPickup && <Pill tone="ok">Can collect child</Pill>}
        {canUpdate && <UnlinkButton householdId={householdId} personId={member.personId} name={name} />}
      </div>
    </li>
  );
}
