/**
 * The routing and headers for the Vercel deployment, in Vercel's Build Output API (v3) format.
 * One place defines what the browser may load and how files are cached.
 */

/** What the browser may load: this origin plus Supabase for sign-in. No inline scripts, no framing. */
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

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'content-security-policy': CONTENT_SECURITY_POLICY,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

/** Paths served by the API function; everything else is a static file from the CDN. */
export const API_PATHS = '^/(?:v1/.*|health|ready)$';
export const FUNCTION_NAME = 'api';

export interface OutputRoute { src?: string; dest?: string; headers?: Record<string, string>; continue?: boolean; handle?: 'filesystem' }
export interface OutputConfig { version: 3; routes: OutputRoute[] }

export function outputConfig(): OutputConfig {
  return {
    version: 3,
    routes: [
      { src: '/(.*)', headers: { ...SECURITY_HEADERS }, continue: true },
      { src: '/assets/(.*)', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true }, // hashed file names
      { handle: 'filesystem' },
      { src: API_PATHS, dest: `/${FUNCTION_NAME}` },
    ],
  };
}

/** How Vercel runs the function. The bundle is one self-contained file, so there is nothing to install at runtime. */
export function functionConfig() {
  return { runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, supportsResponseStreaming: true, maxDuration: 30 };
}
