import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Buxa', template: '%s · Buxa' },
  description: 'Camp and membership management.',
};

export const viewport: Viewport = { colorScheme: 'light dark' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script sets data-theme before React hydrates, on purpose.
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Sets light/dark before first paint to avoid a flash. An external file, so the Content-Security-Policy needs no inline scripts. */}
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
