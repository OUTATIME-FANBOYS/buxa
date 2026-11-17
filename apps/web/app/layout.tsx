import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { BRAND } from '@/config/brand';
import '../styles/index.css';

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  // The browser tab icon. Set explicitly: a metadata icons entry stops Next from adding app/icon.svg to the page, so the tab would show nothing.
  // The home-screen icon on iPhone and iPad. Safari adds the manifest's icons itself on Android and desktop.
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: 'default' },
  // iOS Safari reads this name for standalone mode; Next's appleWebApp.capable emits only the newer mobile-web-app-capable name.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  themeColor: BRAND.themeColour,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render per request: the Content-Security-Policy uses a fresh nonce each time, so pages cannot be built ahead of time.
  await connection();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    // suppressHydrationWarning: the theme script sets data-theme before React hydrates, on purpose.
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Sets light/dark before first paint to avoid a flash. An external file with this request's nonce. */}
        <Script src="/theme-init.js" strategy="beforeInteractive" nonce={nonce} />
        {children}
      </body>
    </html>
  );
}
