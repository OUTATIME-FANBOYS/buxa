'use client';

import { useEffect, useRef, useState } from 'react';
import { createScanDeduper } from './dedupe';

/** Reads a QR code with the phone camera and calls `onScan` once per distinct code. The camera starts only when asked. */
export interface CameraScannerProps { onScan: (raw: string) => void; onClose: () => void }

interface Detector { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> }
interface DetectorCtor { new (options: { formats: string[] }): Detector }
type Phase = 'idle' | 'starting' | 'scanning' | 'denied' | 'failed';

const detectorCtor = (): DetectorCtor | null => {
  const ctor: unknown = Reflect.get(globalThis, 'BarcodeDetector');
  return typeof ctor === 'function' ? (ctor as DetectorCtor) : null;
};

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [phase, setPhase] = useState<Phase>('idle');
  const [supported, setSupported] = useState(true);

  useEffect(() => { setSupported(detectorCtor() !== null && !!navigator.mediaDevices?.getUserMedia); }, []);

  const stop = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };
  useEffect(() => stop, []);

  useEffect(() => {
    if (phase !== 'scanning') return;
    const Ctor = detectorCtor();
    const el = video.current;
    if (!Ctor || !el || !stream.current) return;
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
          if (code && dedupe.accept(code)) onScanRef.current(code);
        } catch { /* a frame that cannot be read is skipped */ }
        await new Promise(r => setTimeout(r, 250));
      }
    };
    void tick();
    return () => { live = false; };
  }, [phase]);

  async function start() {
    setPhase('starting');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      setPhase('scanning');
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed');
    }
  }
  function close() { stop(); onClose(); }

  return (
    <div className="camera-scanner">
      {!supported ? (
        <p role="status">Use the scanner field or type the name. This browser cannot read QR codes with the camera.</p>
      ) : (
        <>
          {phase === 'scanning' && <video ref={video} className="camera-video" playsInline muted aria-label="Camera view for scanning a badge" />}
          {phase === 'idle' && <button type="button" className="btn btn-primary" onClick={() => void start()}>Start camera</button>}
          <p role="status" aria-live="polite">
            {phase === 'starting' && 'Starting the camera...'}
            {phase === 'scanning' && 'Point the camera at the badge.'}
            {phase === 'denied' && 'Camera access was blocked. Allow it in your browser settings, or use the scanner field.'}
            {phase === 'failed' && 'The camera could not be started. Use the scanner field instead.'}
          </p>
        </>
      )}
      <button type="button" className="btn" onClick={close}>Close camera</button>
    </div>
  );
}
