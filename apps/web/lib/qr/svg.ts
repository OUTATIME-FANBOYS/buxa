import qrcode from 'qrcode-generator';

/** Quiet zone, in modules, around the code (the QR specification asks for 4). */
const QUIET = 4;

export interface QrPath { size: number; d: string }

/** The code for `payload` as one SVG path (a unit square per dark module) in a `size` x `size` grid, quiet zone included. Pure, no I/O. */
export function qrPath(payload: string): QrPath {
  const qr = qrcode(0, 'M');
  qr.addData(payload, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  let d = '';
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) if (qr.isDark(y, x)) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
  }
  return { size: count + QUIET * 2, d };
}

/** A standalone SVG document string (no scripts, no external references). */
export function qrSvg(payload: string): string {
  const { size, d } = qrPath(payload);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
