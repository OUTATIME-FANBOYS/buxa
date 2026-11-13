import type { IncomingMessage, ServerResponse } from 'node:http';
import { errorBody } from './http/errors';
import { createRuntime } from './runtime';

/**
 * The API as a Vercel Function (Node.js, Fluid compute). The same Fastify app as `npm run api`, built once per instance and
 * reused across requests. Configuration errors throw here, at load, so a bad deploy fails loudly instead of half-working.
 */
const runtime = createRuntime();
const ready = runtime.app.ready().then(() => runtime.startupCheck);

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if ((await ready) === 'refuse') {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(errorBody(503, 'Service unavailable', String(req.headers['x-vercel-id'] ?? 'unknown'))));
    return;
  }
  runtime.app.server.emit('request', req, res);
}
