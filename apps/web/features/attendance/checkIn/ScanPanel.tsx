'use client';

import { useRef, useState, type RefObject } from 'react';
import { CameraScanner, ScanField } from '@/features/scanner';

interface Props { containerRef: RefObject<HTMLDivElement | null>; disabled: boolean; onCode: (raw: string) => void }

/** The one scan field (handheld scanner or typing), and the camera toggle that opens the phone's camera scanner. */
export function ScanPanel({ containerRef, disabled, onCode }: Props) {
  const [camera, setCamera] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  const closeCamera = () => {
    setCamera(false);
    toggle.current?.focus();
  };

  return (
    <div className="scan-panel" ref={containerRef}>
      <ScanField label="Scan a badge, or type a code" disabled={disabled} onScan={onCode} />
      <button ref={toggle} type="button" className="btn att-btn-lg" aria-expanded={camera} aria-controls="camera-scanner"
        onClick={() => (camera ? closeCamera() : setCamera(true))}>
        {camera ? 'Close camera' : 'Scan with camera'}
      </button>
      {camera && (
        <div id="camera-scanner" className="camera-slot">
          <CameraScanner onScan={raw => { onCode(raw); closeCamera(); }} onClose={closeCamera} />
        </div>
      )}
    </div>
  );
}
