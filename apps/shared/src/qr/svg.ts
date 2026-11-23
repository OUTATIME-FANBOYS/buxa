import qrcode from 'qrcode-generator';

/** Quiet zone, in modules, around the code (the QR specification asks for 4). */
const QUIET = 4;

/**
 * Error correction level H: about 30 percent of the code can be lost, which is what lets a logo sit in the centre and still scan.
 * Level H makes the code denser than M, so a printed badge may need a larger code.
 */
export const QR_ERROR_LEVEL = 'H';

/** The centre logo's side as a share of the code's width (modules, the quiet zone not counted). At most this share. */
export const QR_LOGO_SHARE = 0.18;

export interface QrLogoBox {
  /** Top-left corner and side, in the same units as `size`. The box is centred on the code. */
  x: number;
  y: number;
  side: number;
}

export interface QrPath {
  size: number;
  d: string;
  logo: QrLogoBox;
}

/** The code for `payload` as one SVG path (a unit square per dark module) in a `size` x `size` grid, quiet zone included. Pure, no I/O. */
export function qrPath(payload: string): QrPath {
  const qr = qrcode(0, QR_ERROR_LEVEL);
  qr.addData(payload, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  let d = '';
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (qr.isDark(y, x)) {
        d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
      }
    }
  }

  const size = count + QUIET * 2;
  const side = count * QR_LOGO_SHARE;
  const origin = (size - side) / 2;

  return { size, d, logo: { x: origin, y: origin, side } };
}

/** A standalone SVG document string (no scripts, no external references). */
export function qrSvg(payload: string): string {
  const { size, d } = qrPath(payload);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
