/** The phone width at which the app is laid out as a phone (the same breakpoint the stylesheets use). */
export const PHONE_QUERY = '(max-width: 720px)';

export type InstallPlatform = 'ios' | 'android';

/** Which phone browser this is, or null when the install hint does not apply (desktop, or a browser we give no steps for). */
export function installPlatform(userAgent: string, maxTouchPoints: number): InstallPlatform | null {
  // iPadOS 13+ reports a desktop Mac user agent, so a Mac with touch points is an iPad.
  if (/iPhone|iPod|iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return null;
}

export interface InstallHintInputs {
  platform: InstallPlatform | null;
  /** True when the viewport is phone-sized. */
  phone: boolean;
  /** True when the app already runs installed (from the home screen), so there is nothing to add. */
  installed: boolean;
  /** True once the person has chosen "Not now" or "Got it" on this browser. */
  dismissed: boolean;
}

/** The one rule for when the hint shows: a known phone browser, a phone-sized screen, not installed yet, and not dismissed. */
export function shouldShowInstallHint({ platform, phone, installed, dismissed }: InstallHintInputs): boolean {
  return platform !== null && phone && !installed && !dismissed;
}
