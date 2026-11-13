import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import { migrate } from '../../../packages/db/src';
import { buildApp } from '../src/app';
import { createVerifier } from '../src/auth/verifier';

const url = process.env.DATABASE_URL;
const ISS = 'https://test-project.supabase.co/auth/v1';
const tag = Math.random().toString(36).slice(2, 8);
const uid = () => crypto.randomUUID();

describe.skipIf(!url)('authentication and organisation access', () => {
  const pool = new pg.Pool({ connectionString: url });
  let app: ReturnType<typeof buildApp>;
  let priv: CryptoKey, other: CryptoKey;
  const made = { orgs: [] as string[], users: [] as string[] };

  async function token(over: { sub?: string; email?: string; iss?: string; aud?: string; exp?: string; key?: CryptoKey; alg?: string } = {}) {
    const sub = over.sub ?? uid();
    return new SignJWT({ email: over.email ?? `${sub.slice(0, 8)}-${tag}@camp.test`, user_metadata: { name: 'Test Person' } })
      .setProtectedHeader({ alg: over.alg ?? 'ES256', kid: 'k1' }).setSubject(sub).setIssuer(over.iss ?? ISS)
      .setAudience(over.aud ?? 'authenticated').setIssuedAt().setExpirationTime(over.exp ?? '1h').sign(over.key ?? priv);
  }
  const call = (t: string | null, o: { method?: string; url: string; org?: string; payload?: unknown }) =>
    app.inject({ method: (o.method ?? 'GET') as 'GET', url: o.url, payload: o.payload as object, headers: { ...(t ? { authorization: `Bearer ${t}` } : {}), ...(o.org ? { 'x-org-id': o.org } : {}) } });

  beforeAll(async () => {
    await migrate(pool);
    const kp = await generateKeyPair('ES256'); priv = kp.privateKey;
    other = (await generateKeyPair('ES256')).privateKey;
    const jwk: JWK = { ...(await exportJWK(kp.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
    app = buildApp({ config: { LOG_LEVEL: 'silent', NODE_ENV: 'test' }, pool, verifier: createVerifier({ issuer: ISS, keys: createLocalJWKSet({ keys: [jwk] }) }) });
  });
  afterAll(async () => {
    await pool.query('DELETE FROM orgs WHERE id = ANY($1)', [made.orgs]);
    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`%-${tag}@camp.test`]);
    await app.close(); await pool.end();
  });

  async function makeOrg(t: string, slug: string) {
    const r = await call(t, { method: 'POST', url: '/v1/orgs', payload: { name: slug, slug: `${slug}-${tag}` } });
    expect(r.statusCode).toBe(201); made.orgs.push(r.json().id); return r.json().id as string;
  }
  async function addMember(orgId: string, userEmailTag: string, role: string) {
    const u = await pool.query(`SELECT id FROM users WHERE email LIKE $1`, [`${userEmailTag}%`]);
    await pool.query('INSERT INTO org_members(org_id, user_id, role) VALUES ($1,$2,$3)', [orgId, u.rows[0].id, role]);
  }

  describe('tokens', () => {
    it('no token → 401', async () => {
      const r = await call(null, { url: '/v1/me' });
      expect(r.statusCode).toBe(401); expect(r.headers['www-authenticate']).toBe('Bearer');
      expect(r.json().error.code).toBe('unauthorized');
    });
    it('garbage → 401', async () => { expect((await call('not.a.jwt', { url: '/v1/me' })).statusCode).toBe(401); });
    it('signed by someone else’s key → 401', async () => { expect((await call(await token({ key: other }), { url: '/v1/me' })).statusCode).toBe(401); });
    it('expired → 401', async () => { expect((await call(await token({ exp: '-1h' }), { url: '/v1/me' })).statusCode).toBe(401); });
    it('wrong issuer → 401', async () => { expect((await call(await token({ iss: 'https://evil.supabase.co/auth/v1' }), { url: '/v1/me' })).statusCode).toBe(401); });
    it('wrong audience → 401', async () => { expect((await call(await token({ aud: 'anon' }), { url: '/v1/me' })).statusCode).toBe(401); });
    it('alg "none" → 401', async () => {
      const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const forged = `${b({ alg: 'none', typ: 'JWT' })}.${b({ sub: uid(), email: 'a@b.test', iss: ISS, aud: 'authenticated', exp: 9999999999 })}.`;
      expect((await call(forged, { url: '/v1/me' })).statusCode).toBe(401);
    });
    it('a token in the query string is ignored', async () => {
      const t = await token();
      expect((await app.inject(`/v1/me?access_token=${t}`)).statusCode).toBe(401);
    });
    it('the error never reveals why', async () => {
      const r = await call(await token({ exp: '-1h' }), { url: '/v1/me' });
      expect(r.json().error.message).toBe('Invalid or expired token');
      expect(r.body).not.toMatch(/signature|issuer|audience|claim/i);
    });
  });

  describe('accounts', () => {
    it('first sign-in creates our user, second reuses it', async () => {
      const sub = uid(); const t = await token({ sub });
      const a = (await call(t, { url: '/v1/me' })).json();
      const b = (await call(t, { url: '/v1/me' })).json();
      expect(a.user.id).toBe(b.user.id); expect(a.orgs).toEqual([]); expect(a.user.name).toBe('Test Person');
    });
    it('is linked by provider id, not email: a new identity cannot claim an existing email', async () => {
      const email = `shared-${tag}@camp.test`;
      expect((await call(await token({ email }), { url: '/v1/me' })).statusCode).toBe(200);
      const clash = await call(await token({ email }), { url: '/v1/me' });
      expect(clash.statusCode).toBe(409); // refused, not merged
      expect(clash.json().error.code).toBe('conflict');
    });
  });

  describe('organisations', () => {
    it('creating one makes you its owner and writes an audit row', async () => {
      const t = await token(); const id = await makeOrg(t, 'alpha');
      const me = (await call(t, { url: '/v1/me' })).json();
      expect(me.orgs).toEqual([expect.objectContaining({ orgId: id, role: 'owner' })]);
      const a = await pool.query(`SELECT action FROM audit_log WHERE org_id = $1`, [id]);
      expect(a.rows.map(r => r.action)).toEqual(['org.create']);
    });
    it('duplicate address → 409, bad address → 400', async () => {
      const t = await token(); await makeOrg(t, 'dupe');
      expect((await call(t, { method: 'POST', url: '/v1/orgs', payload: { name: 'x', slug: `dupe-${tag}` } })).statusCode).toBe(409);
      expect((await call(t, { method: 'POST', url: '/v1/orgs', payload: { name: 'x', slug: 'Bad Slug!' } })).statusCode).toBe(400);
      expect((await call(t, { method: 'POST', url: '/v1/orgs', payload: { name: '', slug: 'okay-slug' } })).statusCode).toBe(400);
    });
    it('a user in two organisations sees only the one they select', async () => {
      const t = await token(); const a = await makeOrg(t, 'one'); const b = await makeOrg(t, 'two');
      expect((await call(t, { url: '/v1/org', org: a })).json().id).toBe(a);
      expect((await call(t, { url: '/v1/org', org: b })).json().id).toBe(b);
      const m = (await call(t, { url: '/v1/members', org: a })).json().members;
      expect(m).toHaveLength(1);
    });
    it('a forged organisation id is refused, and looks the same as one that does not exist', async () => {
      const owner = await token(); const orgB = await makeOrg(owner, 'secret');
      const intruder = await token();
      const forged = await call(intruder, { url: '/v1/org', org: orgB });
      const missing = await call(intruder, { url: '/v1/org', org: uid() });
      expect(forged.statusCode).toBe(403); expect(missing.statusCode).toBe(403);
      expect(forged.json().error.message).toBe(missing.json().error.message);
      expect((await call(intruder, { method: 'PATCH', url: '/v1/org', org: orgB, payload: { name: 'pwned' } })).statusCode).toBe(403);
      expect((await call(intruder, { url: '/v1/members', org: orgB })).statusCode).toBe(403);
    });
    it('requires a well-formed x-org-id', async () => {
      const t = await token();
      expect((await call(t, { url: '/v1/org' })).statusCode).toBe(400);
      expect((await call(t, { url: '/v1/org', org: `'; drop table orgs;--` })).statusCode).toBe(400);
    });
  });

  describe('roles are enforced', () => {
    it('viewer reads, staff cannot rename, admin can, and renaming is audited', async () => {
      const owner = await token(); const org = await makeOrg(owner, 'roles');
      const v = await token(), s = await token(), a = await token();
      for (const t of [v, s, a]) await call(t, { url: '/v1/me' });
      for (const [t, role] of [[v, 'viewer'], [s, 'staff'], [a, 'admin']] as const) {
        const email = (await call(t, { url: '/v1/me' })).json().user.email as string;
        await addMember(org, email.slice(0, 12), role);
      }
      expect((await call(v, { url: '/v1/org', org })).statusCode).toBe(200);
      expect((await call(v, { method: 'PATCH', url: '/v1/org', org, payload: { name: 'x' } })).statusCode).toBe(403);
      expect((await call(s, { method: 'PATCH', url: '/v1/org', org, payload: { name: 'x' } })).statusCode).toBe(403);
      expect((await call(s, { url: '/v1/members', org })).json().members).toHaveLength(4);
      const ok = await call(a, { method: 'PATCH', url: '/v1/org', org, payload: { name: 'Renamed' } });
      expect(ok.statusCode).toBe(200); expect(ok.json().name).toBe('Renamed');
      const log = await pool.query(`SELECT action, data FROM audit_log WHERE org_id = $1 AND action = 'org.update'`, [org]);
      expect(log.rows).toEqual([{ action: 'org.update', data: { name: 'Renamed' } }]);
    });
  });
});

describe('without a verifier', () => {
  it('no /v1 routes exist at all', async () => {
    const pool = new pg.Pool({ connectionString: 'postgres://u:p@127.0.0.1:1/none' });
    const app = buildApp({ config: { LOG_LEVEL: 'silent', NODE_ENV: 'test' }, pool });
    expect((await app.inject('/v1/me')).statusCode).toBe(404);
    await app.close(); await pool.end().catch(() => {});
  });
});
