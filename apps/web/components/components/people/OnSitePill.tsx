import { Pill } from '@/components/elements';

/** Checked in and not yet out. Renders nothing otherwise, so "not on site" is never a visible marker. */
export function OnSitePill({ onSite }: { onSite: boolean | null }) {
  return onSite ? <Pill tone="brand">On site</Pill> : null;
}
