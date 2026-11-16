import { describe, expect, it } from 'vitest';
import { installPlatform, shouldShowInstallHint } from './installRules';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

describe('installPlatform', () => {
  it('recognises iPhone and iPad as ios', () => {
    expect(installPlatform(IPHONE, 5)).toBe('ios');
    expect(installPlatform('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5)).toBe('ios');
  });
  it('treats a Mac with touch points as an iPad that asks for the desktop site', () => {
    expect(installPlatform(IPAD_DESKTOP_MODE, 5)).toBe('ios');
  });
  it('does not treat a touchless Mac as ios', () => {
    expect(installPlatform(MAC, 0)).toBeNull();
  });
  it('recognises Android', () => {
    expect(installPlatform(ANDROID, 5)).toBe('android');
  });
  it('gives no hint for anything else', () => {
    expect(installPlatform('Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0', 0)).toBeNull();
  });
});

describe('shouldShowInstallHint', () => {
  const shown = { platform: 'ios' as const, phone: true, installed: false, dismissed: false };
  it('shows on a phone in a known browser, not installed, not dismissed', () => {
    expect(shouldShowInstallHint(shown)).toBe(true);
    expect(shouldShowInstallHint({ ...shown, platform: 'android' })).toBe(true);
  });
  it('is hidden on desktop or a browser with no steps', () => {
    expect(shouldShowInstallHint({ ...shown, phone: false })).toBe(false);
    expect(shouldShowInstallHint({ ...shown, platform: null })).toBe(false);
  });
  it('is hidden once the app is installed or the hint was dismissed', () => {
    expect(shouldShowInstallHint({ ...shown, installed: true })).toBe(false);
    expect(shouldShowInstallHint({ ...shown, dismissed: true })).toBe(false);
  });
});
