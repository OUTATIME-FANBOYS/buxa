/** A printable badge with a QR code of `payload` (what `credentialPayload(token)` returns). Frozen props; chunk P5 renders the real one. */
export interface BadgeCardProps { personName: string; roleLabel: string; campName: string; payload: string }

export function BadgeCard({ personName, campName }: BadgeCardProps) {
  return <div className="badge-placeholder">{campName}: {personName}</div>;
}
