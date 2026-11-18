import { describe, expect, it, vi } from 'vitest';
import { settle } from '@buxa/domain';

// Next.js can load one file once per route, so two parts of the app may hold *different copies* of an error class. An error made by one
// copy then fails `instanceof` against the other, and a 403 turns into a 500. This reproduces that, and checks the guards still work.
describe('errors survive being loaded twice', () => {
  it('HttpError: instanceof fails across copies, isHttpError does not', async () => {
    const first = await import('@buxa/server/http/errors');
    vi.resetModules();
    const second = await import('@buxa/server/http/errors');
    const error = new first.HttpError(403, 'Your role cannot do this');
    expect(error instanceof second.HttpError).toBe(false); // the bug this guards against
    expect(second.isHttpError(error)).toBe(true);
    expect(second.isHttpError(new Error('plain'))).toBe(false);
    expect(second.isHttpError({ kind: 'http-error', statusCode: 403 })).toBe(false); // must be a real Error
  });

  it('the domain errors are recognised across copies too', async () => {
    const a = { users: await import('@buxa/server/users/UserRepository'), orgs: await import('@buxa/server/orgs/OrgRepository') };
    vi.resetModules();
    const b = { users: await import('@buxa/server/users/UserRepository'), orgs: await import('@buxa/server/orgs/OrgRepository') };
    expect(b.users.isEmailInUse(new a.users.EmailInUseError())).toBe(true);
    expect(b.orgs.isSlugTaken(new a.orgs.SlugTakenError())).toBe(true);
    expect(b.orgs.isSlugTaken(new a.users.EmailInUseError())).toBe(false);
  });

  it('a route answers 403, not 500, for an error made by another copy of the module', async () => {
    const { HttpError: Other } = await import('@buxa/server/http/errors');
    vi.resetModules();
    const { startRuntime } = await import('@buxa/server/__tests__/runtimeHarness');
    const { publicRoute } = await import('@buxa/server/http/route');
    const env = startRuntime();
    const response = await publicRoute(() => {
      return settle(() => {
        throw new Other(403, 'Your role cannot do this');
      });
    })(new Request('http://localhost/x'));
    expect(response.status).toBe(403);
    await env.stop();
  });
});
