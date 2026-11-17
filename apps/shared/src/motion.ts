/** Motion primitives after Apple's "Designing Fluid Interfaces": springs, velocity handoff, projection, rubber-banding. */
export const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const haptic = (ms = 6) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

/** Where a flick with this release velocity (px/s) would come to rest — exponential deceleration. */
export const project = (v: number, rate = 0.998) => ((v / 1000) * rate) / (1 - rate);

/** Progressive resistance past a boundary. */
export const rubberband = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));

export interface SpringOpts {
  from: number[]; to: number[]; velocity?: number[];
  /** 1 = critically damped (no overshoot). < 1 only when a gesture carried momentum. */
  damping?: number; response?: number;
  onFrame: (v: number[]) => void; onDone?: () => void;
}
/** Analytic spring per axis, starting from the live value with the gesture's velocity. Returns a cancel function. */
export function springAnimate({ from, to, velocity = [], damping = 1, response = 0.38, onFrame, onDone }: SpringOpts): () => void {
  const w = (2 * Math.PI) / response; const z = Math.min(1, damping); const wd = w * Math.sqrt(Math.max(0, 1 - z * z));
  const dur = Math.max(response * 1.6, 5 / (z * w)); const t0 = performance.now(); let raf = 0; let stopped = false;
  const at = (t: number) => from.map((f, i) => {
    const d0 = f - to[i]; const v0 = velocity[i] ?? 0;
    const d = z >= 1 ? (d0 + (v0 + w * d0) * t) * Math.exp(-w * t)
      : Math.exp(-z * w * t) * (d0 * Math.cos(wd * t) + ((v0 + z * w * d0) / wd) * Math.sin(wd * t));
    return to[i] + d;
  });
  const step = (now: number) => {
    if (stopped) return; const t = (now - t0) / 1000;
    if (t >= dur) { onFrame(to); onDone?.(); return; }
    onFrame(at(t)); raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

/** Rolling window of pointer samples → release velocity in px/s. Zero if the pointer has stopped. */
export class VelocityTracker {
  private pts: { t: number; x: number; y: number }[] = [];
  push(x: number, y = 0) {
    const now = performance.now(); this.pts.push({ t: now, x, y });
    while (this.pts.length > 1 && now - this.pts[0].t > 100) this.pts.shift();
  }
  get(): [number, number] {
    const a = this.pts[0]; const b = this.pts[this.pts.length - 1];
    if (!a || !b || performance.now() - b.t > 80 || b.t - a.t < 8) return [0, 0];
    const dt = (b.t - a.t) / 1000; return [(b.x - a.x) / dt, (b.y - a.y) / dt];
  }
}
