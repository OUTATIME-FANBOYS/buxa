import { Pill } from '@/components/ui';

/** Checked in and not yet out. Renders nothing otherwise, so "not on site" is never a visible marker. */
export function OnSitePill({ onSite }: { onSite: boolean }) {
  return onSite ? <Pill tone="brand">On site</Pill> : null;
}
