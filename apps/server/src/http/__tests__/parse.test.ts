import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, readJson } from '@buxa/server/http/parse';
import { isHttpError } from '@buxa/server/http/errors';
import { publicRoute } from '@buxa/server/http/route';
import { startRuntime } from '@buxa/server/__tests__/runtimeHarness';

const CHUNK = 64 * 1024;

/** A body that arrives in pieces with no Content-Length, and counts how many pieces were actually read. */
function chunkedBody(chunks: number) {
  const state = { pulled: 0 };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.pulled >= chunks) {
        controller.close();

        return;
      }
      state.pulled += 1;
      controller.enqueue(new TextEncoder().encode(' '.repeat(CHUNK))); // whitespace is valid JSON around the value
    },
  });

  return { stream, state };
}

const request = (body: ReadableStream<Uint8Array>) =>
  new Request('http://localhost/x', {
    method: 'POST',
    body,
    duplex: 'half',
    headers: { 'content-type': 'application/json' },
  } as RequestInit);

describe('request body limit', () => {
  it('stops reading a chunked body without Content-Length once it passes the limit', async () => {
    const { stream, state } = chunkedBody(100); // about 6.4 MB if it were all read
    const req = request(stream);
    expect(req.headers.get('content-length')).toBeNull();
    const error: unknown = await readJson(req).catch((e: unknown) => e);
    expect(isHttpError(error)).toBe(true);
    expect(isHttpError(error) && error.statusCode).toBe(413);
    // Reading stops just past the limit: never the whole body.
    // The stream may run a piece or two ahead of the reader; it must not run through the body.
    expect(state.pulled).toBeLessThanOrEqual(Math.ceil(MAX_BODY_BYTES / CHUNK) + 3);
    expect(state.pulled).toBeLessThan(100);
  });

  it('answers 413 in the standard error shape through a route', async () => {
    const env = startRuntime();
    try {
      const route = publicRoute(async ({ request }) => ({ body: await readJson(request) }));
      const { stream } = chunkedBody(100);
      const response = await route(request(stream));
      expect(response.status).toBe(413);
      expect(await response.json()).toMatchObject({
        error: { code: 'payload_too_large', message: 'Request body too large' },
      });
    } finally {
      await env.stop();
    }
  });

  it('still reads a normal body in full, when it fits', async () => {
    const payload = JSON.stringify({ name: 'Summer camp', slug: 'summer' });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Two pieces, split inside a multi-byte character, to check the text is decoded across pieces.
        const bytes = new TextEncoder().encode(payload.replace('Summer', 'Sümmer'));
        controller.enqueue(bytes.slice(0, 12));
        controller.enqueue(bytes.slice(12));
        controller.close();
      },
    });
    expect(await readJson(request(stream))).toEqual({ name: 'Sümmer camp', slug: 'summer' });
  });

  it('treats an empty body as no body', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.close();
      },
    });
    expect(await readJson(request(stream))).toBeUndefined();
  });
});
