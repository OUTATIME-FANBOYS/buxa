export type Point = readonly [number, number];

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A smooth curve through the points, as an SVG path: each segment is a cubic Bézier whose handles follow the neighbouring points
 * (a Catmull-Rom spline, converted to Bézier). With fewer than two points there is no curve, so the path is empty.
 */
export function smoothPath(points: readonly Point[]): string {
  if (points.length < 2) {
    return '';
  }
  let d = `M${round(points[0][0])},${round(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(p2[0])},${round(p2[1])}`;
  }

  return d;
}
