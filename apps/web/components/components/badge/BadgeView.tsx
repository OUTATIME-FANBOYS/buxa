'use client';

import { BadgeCard } from './BadgeCard';
import { Button, PrintButton } from '@/components/elements';

export interface BadgeViewProps {
  personName: string;
  roleLabel: string;
  campName: string;
  /** The QR payload, as the server returned it for Show. */
  payload: string;
  onClose: () => void;
}

/** The one badge view: the card, Print badge and Close. Print lives here and nowhere else. */
export function BadgeView({ personName, roleLabel, campName, payload, onClose }: BadgeViewProps) {
  return (
    <div className="stack people-badge">
      <BadgeCard personName={personName} roleLabel={roleLabel} campName={campName} payload={payload} />
      <div className="row">
        <PrintButton />
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
