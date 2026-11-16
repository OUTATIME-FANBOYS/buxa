import type { MetadataRoute } from 'next';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';

/**
 * The web app manifest: what the phone shows when Buxa is added to the home screen. Installing needs no service worker, so the app
 * is not cached offline. It opens on the check-in screen, the one staff use most at the door.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    start_url: ROUTES.checkIn,
    scope: '/',
    display: 'standalone',
    background_color: BRAND.background,
    theme_color: BRAND.themeColour,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
