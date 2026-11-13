/**
 * What the browser may load and how pages may be framed, defined once. `proxy.ts` applies it to every response.
 * Scripts must be same-origin or carry this request's nonce, so an injected `<script>` cannot run.
 */

export interface PolicyOptions {
  /** A fresh random value for this request. Next.js stamps it on its own inline scripts. */
  nonce: string;
  /** Development needs `eval` for React's tooling and the hot-reload socket; production never does. */
  dev: boolean;
  /** The Supabase project address, so sign-in can reach exactly that origin and no other. */
  supabaseUrl?: string;
}

const supabaseOrigin = (url?: string): string => {
  try { return url ? new URL(url).origin : 'https://*.supabase.co'; } catch { return 'https://*.supabase.co'; }
};

export function buildContentSecurityPolicy({ nonce, dev, supabaseUrl }: PolicyOptions): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'", // React sets inline style attributes, which a nonce cannot cover
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin(supabaseUrl)}${dev ? ' ws: wss:' : ''}`,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};
