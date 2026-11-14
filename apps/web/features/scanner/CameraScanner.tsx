'use client';

/** Reads a QR code with the phone camera and calls `onScan` once per distinct code. Frozen props; chunk P5 builds the real one. */
export interface CameraScannerProps { onScan: (raw: string) => void; onClose: () => void }

export function CameraScanner({ onClose }: CameraScannerProps) {
  return <button type="button" onClick={onClose}>Camera scanning is not available yet</button>;
}
