import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

/**
 * What the browser may load. The app is one origin plus Supabase for sign-in; nothing else, no inline scripts,
 * and it cannot be framed. Applied to the HTML page, which is what the browser enforces it from.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React sets inline style attributes
  "img-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

/**
 * Serves the built web app from `root`. The app uses hash routes, so only `/` and hashed files under `/assets` are needed:
 * unknown paths stay a JSON 404. Hashed assets are cached for a year; the HTML page is never cached.
 */
export function registerStaticSite(app: FastifyInstance, root: string): void {
  app.register(fastifyStatic, {
    root,
    wildcard: false,
    dotfiles: 'ignore',
    cacheControl: false, // we set it per file type below; the plugin's default would overwrite ours
    index: ['index.html'],
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('cache-control', 'no-cache');
        res.setHeader('content-security-policy', CONTENT_SECURITY_POLICY);
      } else if (/[\\/]assets[\\/]/.test(filePath)) {
        res.setHeader('cache-control', 'public, max-age=31536000, immutable');
      }
    },
  });
}
