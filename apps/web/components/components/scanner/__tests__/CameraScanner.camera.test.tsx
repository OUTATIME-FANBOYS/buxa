// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraScanner, type CameraScannerHandle } from '@/components/components/scanner';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;
let getUserMedia: ReturnType<typeof vi.fn>;
let frames: { rawValue: string }[] = [];
let trackStop: ReturnType<typeof vi.fn>;

const buttonByText = (text: string) => [...host.querySelectorAll('button')].find(b => b.textContent === text);
const flush = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

function render(onScan: (raw: string) => void = () => undefined) {
  const handle = createRef<CameraScannerHandle>();
  act(() => {
    root.render(<CameraScanner ref={handle} onScan={onScan} />);
  });

  return handle;
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  // A browser that can read QR codes and has a camera: the only thing left to decide is when the camera starts.
  frames = [];
  vi.stubGlobal(
    'BarcodeDetector',
    class {
      detect(): Promise<{ rawValue: string }[]> {
        return Promise.resolve(frames);
      }
    },
  );
  trackStop = vi.fn();
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  // jsdom has no media playback; the scanner calls play() once the camera is on.
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('camera scanner', () => {
  it('does not ask for the camera on render, only when the parent calls start', () => {
    const handle = render();
    expect(getUserMedia).not.toHaveBeenCalled();
    act(() => handle.current?.start());
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Starting the camera...');
  });

  it('a refused camera explains what to do and offers a retry that asks again', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    const handle = render();
    act(() => handle.current?.start());
    await flush();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Camera access is blocked.');
    expect(host.textContent).toContain('You can still type the code or name above.');
    act(() => buttonByText('Try the camera again')?.click());
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('a camera that fails to start shows the failure message and the retry', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('busy', 'NotReadableError'));
    const handle = render();
    act(() => handle.current?.start());
    await flush();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('The camera could not start.');
    expect(buttonByText('Try the camera again')).toBeDefined();
  });

  it('stop switches the camera off once it is running', async () => {
    const handle = render();
    act(() => handle.current?.start());
    await flush();
    act(() => handle.current?.stop());
    expect(trackStop).toHaveBeenCalledTimes(1);
  });

  it('stop during start switches off the camera when it arrives late', async () => {
    let grant: (stream: unknown) => void = () => undefined;
    getUserMedia.mockReturnValueOnce(new Promise(resolve => (grant = resolve)));
    const handle = render();
    act(() => handle.current?.start());
    act(() => handle.current?.stop());
    grant({ getTracks: () => [{ stop: trackStop }] });
    await flush();
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(host.querySelector('video')).toBeNull();
  });

  it('a scan reports the code once and switches the camera off', async () => {
    frames = [{ rawValue: 'bx1.abc' }];
    const onScan = vi.fn();
    const handle = render(onScan);
    act(() => handle.current?.start());
    await flush();
    expect(onScan).toHaveBeenCalledWith('bx1.abc');
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(trackStop).toHaveBeenCalledTimes(1);
  });
});
