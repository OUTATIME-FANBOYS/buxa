import { Pill } from '@/components/elements';
import { BadgeReveal } from '@/components/components/badge';
import { BadgeActions } from '@/components/components/people/forms';

export interface BadgePanelProps {
  personId: string;
  personName: string;
  roleLabel: string;
  campName: string;
  hasActiveBadge: boolean;
  archived: boolean;
  canManage: boolean;
}

/**
 * The badge (QR code) for the door. Whether one is active is shown in words. Admins and owners can show it on demand (and reprint it
 * for a damaged card), and reissue it for a lost one. The code leaves the server only when Show or Reprint is pressed.
 */
export function BadgePanel({
  personId,
  personName,
  roleLabel,
  campName,
  hasActiveBadge,
  archived,
  canManage,
}: BadgePanelProps) {
  return (
    <section className="panel" aria-labelledby="badge-heading">
      <div className="panel-head">
        <h2 id="badge-heading" className="people-heading">
          Badge
        </h2>
        {hasActiveBadge ? <Pill tone="ok">Badge active</Pill> : <Pill tone="neutral">No active badge</Pill>}
      </div>
      {archived ? (
        <p className="muted">Archived people cannot have a badge.</p>
      ) : canManage ? (
        <div className="stack">
          {hasActiveBadge && (
            <BadgeReveal
              personId={personId}
              personName={personName}
              roleLabel={roleLabel}
              campName={campName}
              canReprint
            />
          )}
          <BadgeActions
            personId={personId}
            hasActiveBadge={hasActiveBadge}
            personName={personName}
            roleLabel={roleLabel}
            campName={campName}
          />
        </div>
      ) : (
        <p className="muted">Only admins can issue or revoke badges.</p>
      )}
    </section>
  );
}
