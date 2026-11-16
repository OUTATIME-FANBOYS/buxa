import { qrPath } from '@/lib/qr/svg';

/** A printable badge with a QR code of `payload` (what `credentialPayload(token)` returns). Server-renderable; the code is inline SVG. */
export interface BadgeCardProps { personName: string; roleLabel: string; campName: string; payload: string }

export function BadgeCard({ personName, roleLabel, campName, payload }: BadgeCardProps) {
  const { size, d } = qrPath(payload);
  return (
    <section className="badge-card" aria-label={`Badge for ${personName}`}>
      <div className="badge-text">
        <p className="badge-camp">{campName}</p>
        <h2 className="badge-name">{personName}</h2>
        <p className="badge-role">{roleLabel}</p>
      </div>
      <svg className="badge-qr" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${personName}'s badge. Scan it at check-in.`}>
        <rect width={size} height={size} fill="#fff" />
        <path d={d} fill="#000" />
      </svg>
    </section>
  );
}
