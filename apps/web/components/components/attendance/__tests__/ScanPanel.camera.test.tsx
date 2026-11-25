// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanPanel } from '@/components/components/attendance';
import type { ScanFieldHandle } from '@/components/components/scanner';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;
let getUserMedia: ReturnType<typeof vi.fn>;
let frames: { rawValue: string }[] = [];
let trackStop: ReturnType<typeof vi.fn>;
let onCode: ReturnType<typeof vi.fn>;

const buttons = () => [...host.querySelectorAll('button')];
const buttonByText = (text: string) => buttons().find(b => b.textContent === text);
const panel = () => host.querySelector('#camera-scanner');
const flush = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

function render() {
  act(() => {
    root.render(<ScanPanel scanRef={createRef<ScanFieldHandle>()} disabled={false} onCode={onCode} />);
  });
}

function stubCameraBrowser() {
  vi.stubGlobal(
    'BarcodeDetector',
    class {
      detect(): Promise<{ rawValue: string }[]> {
        return Promise.resolve(frames);
      }
    },
  );
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  frames = [];
  trackStop = vi.fn();
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });
  onCode = vi.fn();
  stubCameraBrowser();
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('ScanPanel camera', () => {
  it('one tap on Scan with camera opens the panel and starts the camera', () => {
    render();
    expect(panel()?.hasAttribute('hidden')).toBe(true);
    act(() => buttonByText('Scan with camera')?.click());
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(panel()?.hasAttribute('hidden')).toBe(false);
    expect(buttonByText('Close camera')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('there is no second Start camera button', () => {
    render();
    act(() => buttonByText('Scan with camera')?.click());
    expect(buttonByText('Start camera')).toBeUndefined();
    expect(host.textContent).not.toContain('Start camera');
  });

  it('shows the starting message while the camera is starting', () => {
    getUserMedia.mockReturnValueOnce(new Promise(() => undefined));
    render();
    act(() => buttonByText('Scan with camera')?.click());
    expect(panel()?.textContent).toContain('Starting the camera...');
  });

  it('there is exactly one Close camera control, on the main button', () => {
    render();
    act(() => buttonByText('Scan with camera')?.click());
    const closes = buttons().filter(b => b.textContent === 'Close camera');
    expect(closes).toHaveLength(1);
    expect(closes[0]?.className).toContain('btn-camera');
    expect(panel()?.querySelector('button')).toBeNull();
  });

  it('closing with the main button stops the camera and hides the panel', async () => {
    render();
    act(() => buttonByText('Scan with camera')?.click());
    await flush();
    act(() => buttonByText('Close camera')?.click());
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(panel()?.hasAttribute('hidden')).toBe(true);
    expect(buttonByText('Scan with camera')).toBeDefined();
  });

  it('a blocked camera shows the message and a retry that asks again', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    render();
    act(() => buttonByText('Scan with camera')?.click());
    await flush();
    expect(panel()?.querySelector('[role="alert"]')?.textContent).toContain('Camera access is blocked.');
    act(() => buttonByText('Try the camera again')?.click());
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('a browser that cannot read QR codes hides the camera button and keeps the message', async () => {
    Reflect.deleteProperty(globalThis, 'BarcodeDetector');
    render();
    await flush();
    expect(buttonByText('Scan with camera')).toBeUndefined();
    expect(host.textContent).toContain('This browser cannot read QR codes with the camera.');
    expect(host.querySelector('input')).not.toBeNull();
  });

  it('a scan sends the code to the field and closes the camera', async () => {
    frames = [{ rawValue: 'bx1.abc' }];
    render();
    act(() => buttonByText('Scan with camera')?.click());
    await flush();
    expect(onCode).toHaveBeenCalledWith('bx1.abc');
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(panel()?.hasAttribute('hidden')).toBe(true);
    expect(buttonByText('Scan with camera')).toBeDefined();
  });
});
