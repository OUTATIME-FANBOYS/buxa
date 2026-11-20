'use client';

import { useRef, useState, type RefObject } from 'react';
import { CameraScanner } from '@/components/components/scanner';
import { ScanField, type ScanFieldHandle } from '@/components/components/scanner';
import { Button } from '@/components/elements';

interface Props {
  scanRef: RefObject<ScanFieldHandle | null>;
  disabled: boolean;
  onCode: (raw: string) => void;
}

/** The one scan field (handheld scanner or typing), and the camera toggle that opens the phone's camera scanner. */
export function ScanPanel({ scanRef, disabled, onCode }: Props) {
  const [camera, setCamera] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  const closeCamera = () => {
    setCamera(false);
    toggle.current?.focus();
  };

  return (
    <div className="scan-panel">
      <ScanField ref={scanRef} label="Scan a badge, or type a code" disabled={disabled} onScan={onCode} />
      <Button
        variant="primary"
        ref={toggle}
        type="button"
        size="lg"
        className="btn-camera"
        aria-expanded={camera}
        aria-controls="camera-scanner"
        onClick={() => (camera ? closeCamera() : setCamera(true))}
      >
        {camera ? 'Close camera' : 'Scan with camera'}
      </Button>
      {camera && (
        <div id="camera-scanner" className="camera-slot">
          <CameraScanner
            onScan={raw => {
              onCode(raw);
              closeCamera();
            }}
            onClose={closeCamera}
          />
        </div>
      )}
    </div>
  );
}
