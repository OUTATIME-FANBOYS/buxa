import { Pill } from '@/components/ui';
import { BadgeActions } from '../forms/BadgeActions';

export interface BadgePanelProps {
  personId: string;
  personName: string;
  roleLabel: string;
  campName: string;
  hasActiveBadge: boolean;
  archived: boolean;
  canManage: boolean;
}

/** The badge (QR code) for the door. Whether one is active is shown in words; the code itself is only ever displayed at issue. */
export function BadgePanel({ personId, personName, roleLabel, campName, hasActiveBadge, archived, canManage }: BadgePanelProps) {
  return (
    <section className="panel" aria-labelledby="badge-heading">
      <div className="panel-head">
        <h2 id="badge-heading" className="people-heading">Badge</h2>
        {hasActiveBadge ? <Pill tone="ok">Badge active</Pill> : <Pill tone="neutral">No active badge</Pill>}
      </div>
      {archived ? <p className="muted">Archived people cannot have a badge.</p>
        : canManage ? <BadgeActions personId={personId} hasActiveBadge={hasActiveBadge} personName={personName} roleLabel={roleLabel} campName={campName} />
        : <p className="muted">Only admins can issue or revoke badges.</p>}
    </section>
  );
}
