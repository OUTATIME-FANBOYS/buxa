/** The Buxa mark: a white camp tent on the teal tile, the same drawing as the favicon (app/icon.svg). */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="brand-mark">
      <rect className="brand-mark-tile" width="32" height="32" rx="8" fill="#0f7173" />
      <path d="M6 25 L16 8 L26 25 Z" fill="#ffffff" />
      <path className="brand-mark-cut" d="M16 17 L11.5 25 L20.5 25 Z" fill="#0f7173" />
      <path d="M16 8 V3" stroke="#ffffff" strokeWidth="1.2" fill="none" />
      <path d="M16 3 L21 4.5 L16 6 Z" fill="#ffffff" />
    </svg>
  );
}
