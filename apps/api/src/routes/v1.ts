import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { authorize, type Action, type Actor } from '../../../../packages/domain/src';
import { withOrg } from '../../../../packages/db/src';
import { membershipsOf, upsertUser, type Membership, type User } from '../auth/session';
import type { Verifier } from '../auth/verifier';
import { httpError, parseBody } from '../http';

declare module 'fastify' { interface FastifyRequest { user: User | null; memberships: Membership[] } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NewOrg = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, 'use 3-50 lowercase letters, digits or dashes') });
const OrgPatch = z.object({ name: z.string().trim().min(1).max(120) });

export function registerV1(app: FastifyInstance, deps: { pool: Pool; verifier: Verifier }) {
  const { pool, verifier } = deps;

  app.register(async v1 => {
    v1.decorateRequest('user', null);
    v1.decorateRequest('memberships', null as unknown as Membership[]);

    // Every /v1 route needs a valid token. Tokens come only from the Authorization header, never the URL.
    v1.addHook('preHandler', async (req, reply) => {
      const h = req.headers.authorization;
      const token = h?.startsWith('Bearer ') ? h.slice(7).trim() : '';
      if (!token) { reply.header('www-authenticate', 'Bearer'); throw httpError(401, 'Sign in required'); }
      let who;
      try { who = await verifier(token); }
      catch (e) { req.log.info({ reason: (e as Error).name }, 'token rejected'); reply.header('www-authenticate', 'Bearer'); throw httpError(401, 'Invalid or expired token'); }
      req.user = await upsertUser(pool, who);
      req.memberships = await membershipsOf(pool, req.user.id);
    });

    /** The organisation named by x-org-id, only if the signed-in user belongs to it. Same answer whether it exists or not. */
    function actorFor(req: FastifyRequest): Actor {
      const id = req.headers['x-org-id'];
      if (typeof id !== 'string' || !id) throw httpError(400, 'x-org-id header is required');
      if (!UUID.test(id)) throw httpError(400, 'x-org-id must be an organisation id');
      const m = req.memberships.find(x => x.orgId === id);
      if (!m) throw httpError(403, 'You do not have access to this organisation');
      return { userId: req.user!.id, orgId: m.orgId, role: m.role };
    }
    function allow(actor: Actor, action: Action) {
      if (!authorize(actor, action).allow) throw httpError(403, 'Your role cannot do this');
    }

    v1.get('/me', async req => ({ user: req.user, orgs: req.memberships }));

    v1.post('/orgs', async (req, reply) => {
      const body = parseBody(NewOrg, req.body);
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const o = (await c.query('INSERT INTO orgs(name, slug) VALUES ($1, $2) RETURNING id, name, slug', [body.name, body.slug])).rows[0];
        await c.query(`INSERT INTO org_members(org_id, user_id, role) VALUES ($1, $2, 'owner')`, [o.id, req.user!.id]);
        await c.query(`INSERT INTO audit_log(org_id, actor_id, action, entity, entity_id) VALUES ($1, $2, 'org.create', 'org', $3)`, [o.id, req.user!.id, String(o.id)]);
        await c.query('COMMIT');
        return reply.code(201).send({ ...o, role: 'owner' });
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        if ((e as { code?: string }).code === '23505') throw httpError(409, 'That address is already taken');
        throw e;
      } finally { c.release(); }
    });

    v1.get('/org', async req => {
      const actor = actorFor(req); allow(actor, 'org:read');
      return withOrg(pool, actor.orgId, async db => (await db.query('SELECT id, name, slug, created_at FROM orgs')).rows[0]);
    });

    v1.patch('/org', async req => {
      const actor = actorFor(req); allow(actor, 'org:update');
      const body = parseBody(OrgPatch, req.body);
      return withOrg(pool, actor.orgId, async db => {
        const o = (await db.query('UPDATE orgs SET name = $1 WHERE id = $2 RETURNING id, name, slug', [body.name, actor.orgId])).rows[0];
        await db.query(`INSERT INTO audit_log(org_id, actor_id, action, entity, entity_id, data) VALUES ($1, $2, 'org.update', 'org', $3, $4)`, [actor.orgId, actor.userId, actor.orgId, { name: body.name }]);
        return o;
      });
    });

    v1.get('/members', async req => {
      const actor = actorFor(req); allow(actor, 'members:read');
      return withOrg(pool, actor.orgId, async db => ({
        members: (await db.query(`SELECT u.id, u.name, u.email, m.role FROM org_members m JOIN users u ON u.id = m.user_id ORDER BY u.name`)).rows,
      }));
    });
  }, { prefix: '/v1' });
}
