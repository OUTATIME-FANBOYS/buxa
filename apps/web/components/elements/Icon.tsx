import { ICONS } from './icons';

/** Renders a named icon from the lucide-react set (see icons.tsx). Unknown names render an empty, decorative svg. */
export function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Glyph = ICONS[name];

  if (!Glyph) {
    return <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" />;
  }

  return <Glyph className={className} size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}
