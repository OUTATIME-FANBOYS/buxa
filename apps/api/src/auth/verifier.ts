import { jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface Identity { authId: string; email: string; name: string }
export type Verifier = (token: string) => Promise<Identity>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks a Supabase access token: signature against the project's public keys, issuer, audience and expiry.
 * Only asymmetric algorithms are accepted, so `none` and shared-secret tricks are impossible.
 * `keys` is the project's JWKS in production and a local key set in tests.
 */
export function createVerifier(opts: { issuer: string; keys: JWTVerifyGetKey }): Verifier {
  return async token => {
    const { payload } = await jwtVerify(token, opts.keys, {
      issuer: opts.issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'], clockTolerance: 5,
    });
    const { sub, email } = payload;
    if (typeof sub !== 'string' || !UUID.test(sub) || typeof email !== 'string' || !email.includes('@')) throw new Error('token is missing required claims');
    const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
    const given = typeof meta.name === 'string' ? meta.name.trim() : typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
    return { authId: sub, email: email.toLowerCase(), name: (given || email.split('@')[0]).slice(0, 120) };
  };
}
