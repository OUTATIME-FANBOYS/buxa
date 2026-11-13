import type { Tone } from './tones';

/** Clamp to 0-100 and round: what the bar shows and what a screen reader hears. */
export const progressValue = (value: number) => Math.round(Math.min(100, Math.max(0, value)));

export function Progress({ value, label, tone = 'brand' }: { value: number; label?: string; tone?: Tone }) {
  const v = progressValue(value);
  return <div className={`progress tone-${tone}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}><span style={{ width: v + '%' }} /></div>;
}
