'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { CameraScanner, canReadQrWithCamera, type CameraScannerHandle } from '@/components/components/scanner';
import { ScanField, type ScanFieldHandle } from '@/components/components/scanner';
import { Button } from '@/components/elements';

interface Props {
  scanRef: RefObject<ScanFieldHandle | null>;
  disabled: boolean;
  onCode: (raw: string) => void;
}

/**
 * The one scan field (handheld scanner or typing), and the one camera button. A tap opens the camera panel and starts the camera
 * in the same tap; the same button closes it and stops the camera.
 */
export function ScanPanel({ scanRef, disabled, onCode }: Props) {
  const [camera, setCamera] = useState(false);
  // Shown until the page loads, so the server markup matches the first client render; hidden if the browser has no QR camera.
  const [cameraSupported, setCameraSupported] = useState(true);
  const toggle = useRef<HTMLButtonElement>(null);
  const scanner = useRef<CameraScannerHandle>(null);

  useEffect(() => {
    setCameraSupported(canReadQrWithCamera());
  }, []);

  const openCamera = () => {
    setCamera(true);
    scanner.current?.start();
  };

  const closeCamera = () => {
    scanner.current?.stop();
    setCamera(false);
    toggle.current?.focus();
  };

  return (
    <div className="scan-panel">
      <ScanField ref={scanRef} label="Scan a badge, or type a code" disabled={disabled} onScan={onCode} />
      {cameraSupported ? (
        <Button
          variant="primary"
          ref={toggle}
          type="button"
          size="lg"
          className="btn-camera"
          aria-expanded={camera}
          aria-controls="camera-scanner"
          onClick={() => (camera ? closeCamera() : openCamera())}
        >
          {camera ? 'Close camera' : 'Scan with camera'}
        </Button>
      ) : (
        <p role="status">Use the scanner field or type the name. This browser cannot read QR codes with the camera.</p>
      )}
      <div id="camera-scanner" className="camera-slot" hidden={!camera}>
        <CameraScanner
          ref={scanner}
          onScan={raw => {
            onCode(raw);
            setCamera(false);
            toggle.current?.focus();
          }}
        />
      </div>
    </div>
  );
}
