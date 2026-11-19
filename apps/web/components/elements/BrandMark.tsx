/** The Buxa mark: a white camp tent on the teal tile, the same drawing as the favicon (app/icon.svg). */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className="brand-mark">
      <rect className="brand-mark-tile" width="32" height="32" rx="8" fill="#0f7173" />
      <path d="M6 27 L16 10 L26 27 Z" fill="#ffffff" />
      <path className="brand-mark-cut" d="M16 19 L11.5 27 L20.5 27 Z" fill="#0f7173" />
      <path d="M16 10 V5" stroke="#ffffff" strokeWidth="1.2" fill="none" />
      <path d="M16 5 L21 6.5 L16 8 Z" fill="#ffffff" />
    </svg>
  );
}
