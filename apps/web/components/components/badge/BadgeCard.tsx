import { qrPath } from '@buxa/shared';

/**
 * The app icon in one colour: the mountain with its door and the flag, as a single fill. It takes the card's text colour (black on
 * the white badge). It is decoration only, so it is hidden from assistive technology.
 */
function BadgeLogo() {
  return (
    <svg className="badge-logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M6 27 L16 10 L26 27 Z M16 19 L11.5 27 L20.5 27 Z M15.2 4.5 H15.8 V10 H15.2 Z M15.8 4.5 L21 6.2 L15.8 7.9 Z"
      />
    </svg>
  );
}

/** A printable badge with a QR code of `payload` (what `credentialPayload(token)` returns). Server-renderable; the code is inline SVG. */
interface BadgeCardProps {
  personName: string;
  roleLabel: string;
  campName: string;
  payload: string;
}

export function BadgeCard({ personName, roleLabel, campName, payload }: BadgeCardProps) {
  const { size, d } = qrPath(payload);

  return (
    <section className="badge-card" aria-label={`Badge for ${personName}`}>
      <div className="badge-text">
        <p className="badge-camp">{campName}</p>
        <h2 className="badge-name">{personName}</h2>
        <p className="badge-role">{roleLabel}</p>
      </div>
      <svg
        className="badge-qr"
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`QR code for ${personName}'s badge. Scan it at check-in.`}
      >
        <rect width={size} height={size} fill="#fff" />
        <path d={d} fill="#000" />
      </svg>
      <BadgeLogo />
    </section>
  );
}
