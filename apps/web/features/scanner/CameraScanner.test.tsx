// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraScanner } from './CameraScanner';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;
let getUserMedia: ReturnType<typeof vi.fn>;

const buttonByText = (text: string) => [...host.querySelectorAll('button')].find(b => b.textContent === text) as HTMLButtonElement | undefined;

async function render() {
  await act(async () => {
    root.render(<CameraScanner onScan={() => undefined} onClose={() => undefined} />);
  });
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  // A browser that can read QR codes and has a camera: the only thing left to decide is when the camera starts.
  vi.stubGlobal('BarcodeDetector', class { detect() { return Promise.resolve([]); } });
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
  // jsdom has no media playback; the scanner calls play() once the camera is on.
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('camera scanner', () => {
  it('does not ask for the camera when it is shown, only after the person taps Start camera', async () => {
    await render();
    expect(getUserMedia).not.toHaveBeenCalled();
    await act(async () => buttonByText('Start camera')?.click());
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('a refused camera explains what to do and offers a retry that asks again', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    await render();
    await act(async () => buttonByText('Start camera')?.click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Camera access is blocked.');
    expect(host.textContent).toContain('You can still type the code or name above.');
    await act(async () => buttonByText('Try the camera again')?.click());
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });
});
