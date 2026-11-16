import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import Script from 'next/script';
import type { ReactNode } from 'react';
import '../styles/index.css';

export const metadata: Metadata = {
  title: { default: 'Buxa', template: '%s · Buxa' },
  description: 'Camp and membership management.',
};

export const viewport: Viewport = { colorScheme: 'light dark' };

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
