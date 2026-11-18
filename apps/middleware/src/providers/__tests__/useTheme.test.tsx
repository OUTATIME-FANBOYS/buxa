// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useTheme } from '../useTheme';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches: dark, addEventListener() {}, removeEventListener() {} }));
}

function Probe({ theme }: { theme: 'system' | 'light' | 'dark' }) {
  useTheme(theme);

  return null;
}

describe('useTheme', () => {
  let root: Root;
  beforeEach(() => {
    root = createRoot(document.body.appendChild(document.createElement('div')));
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it('applies an explicit light or dark choice', () => {
    setSystemDark(true);
    act(() => root.render(<Probe theme="light" />));
    expect(document.documentElement.dataset.theme).toBe('light');
    act(() => root.render(<Probe theme="dark" />));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
  it('follows the system setting when the choice is system', () => {
    setSystemDark(true);
    act(() => root.render(<Probe theme="system" />));
    expect(document.documentElement.dataset.theme).toBe('dark');
    setSystemDark(false);
    act(() => root.render(<Probe theme="system" />));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
