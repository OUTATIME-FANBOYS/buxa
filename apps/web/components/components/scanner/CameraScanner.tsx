'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createScanDeduper } from '@buxa/shared';
import { Button } from '@/components/elements';

/**
 * Reads a QR code with the phone camera and calls `onScan` once per distinct code. The camera never starts on its own:
 * the parent calls `start` from a tap handler, so the browser treats it as a user gesture. A scan stops the camera.
 */
interface CameraScannerProps {
  onScan: (raw: string) => void;
}

/** What the parent can ask the scanner to do. `stop` also cancels a camera that is still starting. */
export interface CameraScannerHandle {
  start: () => void;
  stop: () => void;
}

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
interface DetectorCtor {
  new (options: { formats: string[] }): Detector;
}
type Phase = 'idle' | 'starting' | 'scanning' | 'denied' | 'failed';

const detectorCtor = (): DetectorCtor | null => {
  const ctor: unknown = Reflect.get(globalThis, 'BarcodeDetector');

  return typeof ctor === 'function' ? (ctor as DetectorCtor) : null;
};

/** True when this browser can read QR codes and has a camera API. Checked after the page has loaded, never during render. */
export function canReadQrWithCamera(): boolean {
  return detectorCtor() !== null && !!navigator.mediaDevices?.getUserMedia;
}

export const CameraScanner = forwardRef<CameraScannerHandle, CameraScannerProps>(function CameraScanner(
  { onScan },
  handle,
) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  // Each start gets a number. A stop moves the number on, so a camera that finishes starting after a stop is switched off.
  const attempt = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [phase, setPhase] = useState<Phase>('idle');

  const stop = useCallback(() => {
    attempt.current += 1;
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    setPhase('idle');
  }, []);

  const start = useCallback(() => {
    attempt.current += 1;
    const mine = attempt.current;
    setPhase('starting');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(
      found => {
        if (mine !== attempt.current) {
          found.getTracks().forEach(t => t.stop());

          return;
        }
        stream.current = found;
        setPhase('scanning');
      },
      (err: unknown) => {
        if (mine !== attempt.current) {
          return;
        }
        const name = err instanceof DOMException ? err.name : '';
        setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed');
      },
    );
  }, []);

  useImperativeHandle(handle, () => ({ start, stop }), [start, stop]);
  // Leaving the page (the panel unmounts) switches the camera off.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (phase !== 'scanning') {
      return;
    }
    const Ctor = detectorCtor();
    const el = video.current;
    if (!Ctor || !el || !stream.current) {
      return;
    }
    const detector = new Ctor({ formats: ['qr_code'] });
    const dedupe = createScanDeduper(Infinity);
    let live = true;
    el.srcObject = stream.current;
    void el.play().catch(() => undefined);
    const tick = async () => {
      while (live) {
        try {
          const found = await detector.detect(el);
          const code = found[0]?.rawValue;
          if (code && dedupe.accept(code)) {
            live = false;
            stop();
            onScanRef.current(code);

            return;
          }
        } catch {
          /* a frame that cannot be read is skipped */
        }
        await new Promise(r => setTimeout(r, 250));
      }
    };
    void tick();

    return () => {
      live = false;
    };
  }, [phase, stop]);

  return (
    <div className="camera-scanner">
      {phase === 'scanning' && (
        <video ref={video} className="camera-video" playsInline muted aria-label="Camera view for scanning a badge" />
      )}
      {(phase === 'denied' || phase === 'failed') && (
        <>
          <p className="notice tone-crit" role="alert">
            <strong>{phase === 'denied' ? 'Camera access is blocked.' : 'The camera could not start.'}</strong>
            <span>
              {phase === 'denied'
                ? 'Allow the camera for this site in your browser settings, then try again. You can still type the code or name above.'
                : 'Try again, or type the code or name above.'}
            </span>
          </p>
          <Button variant="primary" type="button" onClick={start}>
            Try the camera again
          </Button>
        </>
      )}
      <p role="status" aria-live="polite">
        {phase === 'starting' && 'Starting the camera...'}
        {phase === 'scanning' && 'Point the camera at the badge.'}
      </p>
    </div>
  );
});
