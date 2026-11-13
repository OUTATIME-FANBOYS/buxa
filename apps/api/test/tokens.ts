import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import { createVerifier, type Verifier } from '../src/auth/verifier';

export const ISSUER = 'https://test-project.supabase.co/auth/v1';

export interface TokenOptions { sub?: string; email?: string; issuer?: string; audience?: string; expiresIn?: string; signWith?: CryptoKey }

/** A throwaway identity provider: real signed tokens and a matching verifier, with no network and no Supabase. */
export async function createTestIdentityProvider() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const strangerKey = (await generateKeyPair('ES256')).privateKey;
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
  const verifier: Verifier = createVerifier({ issuer: ISSUER, keys: createLocalJWKSet({ keys: [jwk] }) });

  async function token(options: TokenOptions = {}): Promise<string> {
    const sub = options.sub ?? crypto.randomUUID();
    return new SignJWT({ email: options.email ?? `${sub.slice(0, 8)}@camp.test`, user_metadata: { name: 'Test Person' } })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' }).setSubject(sub).setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? 'authenticated').setIssuedAt().setExpirationTime(options.expiresIn ?? '1h')
      .sign(options.signWith ?? privateKey);
  }
  return { verifier, token, strangerKey };
}
