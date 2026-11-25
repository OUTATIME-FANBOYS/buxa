/**
 * A person's picture. Until profile pictures are built (a later phase), every person shows the same blank template: a silhouette in a
 * circle. It is decorative: the person's name beside it is the label.
 */
export function PersonAvatar({ size = 28 }: { size?: number }) {
  return (
    <span
      className="person-avatar"
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--line)',
        color: 'var(--muted)',
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="8" r="4.5" />
        <path d="M3.5 21c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5z" />
      </svg>
    </span>
  );
}
