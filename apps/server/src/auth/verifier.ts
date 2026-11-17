import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { isUuid } from '@buxa/domain';
import type { Identity } from './identity';

/** Turns a bearer token into who is calling, or throws. This is the seam to the identity provider. */
export type Verifier = (token: string) => Promise<Identity>;

const ClaimsSchema = z.object({
  sub: z.string().refine(isUuid, 'sub must be a UUID'),
  email: z.string().email(),
  user_metadata: z.object({ name: z.string().optional(), full_name: z.string().optional() }).optional(),
});

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
    const claims = ClaimsSchema.parse(payload);
    const given = (claims.user_metadata?.name ?? claims.user_metadata?.full_name ?? '').trim();
    return { authId: claims.sub, email: claims.email.toLowerCase(), name: (given || claims.email.split('@')[0]).slice(0, 120) };
  };
}
