// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INSTALL_HINT_KEY } from './dismissal';
import { InstallHint } from './InstallHint';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';

let host: HTMLDivElement;
let root: Root;
let values: Map<string, string>;

/** jsdom's localStorage is not reliable here, so the hint gets an in-memory store with the same shape. */
function fakeLocalStorage() {
  values = new Map();
  const store = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    clear: () => values.clear(),
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: store });
}

/** Makes the page look like a phone (or not) and the device a known browser (or not). */
function setDevice({ userAgent, phone }: { userAgent: string; phone: boolean }) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => userAgent });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => (phone ? 5 : 0) });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('max-width') ? phone : false, media: query, addEventListener() {}, removeEventListener() {} }));
}

async function render() {
  await act(async () => { root.render(<InstallHint />); });
}

beforeEach(() => {
  fakeLocalStorage();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'userAgent');
  Reflect.deleteProperty(navigator, 'maxTouchPoints');
});

describe('install hint', () => {
  it('shows iOS steps on an iPhone at phone width', async () => {
    setDevice({ userAgent: IPHONE, phone: true });
    await render();
    expect(host.querySelector('.install-hint')).not.toBeNull();
    expect(host.textContent).toContain('tap the Share button, then Add to Home Screen');
  });

  it('renders nothing on a desktop browser', async () => {
    setDevice({ userAgent: DESKTOP, phone: false });
    await render();
    expect(host.querySelector('.install-hint')).toBeNull();
  });

  it('"Not now" hides it and remembers the choice in this browser', async () => {
    setDevice({ userAgent: IPHONE, phone: true });
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('.btn-ghost')?.click());
    expect(host.querySelector('.install-hint')).toBeNull();
    expect(values.get(INSTALL_HINT_KEY)).toBe('1');
  });

  it('stays hidden when the choice was already remembered', async () => {
    values.set(INSTALL_HINT_KEY, '1');
    setDevice({ userAgent: IPHONE, phone: true });
    await render();
    expect(host.querySelector('.install-hint')).toBeNull();
  });
});
