import { describe, expect, it } from 'vitest';
import { ACCOUNT_CONFLICT_MESSAGE, sessionFromToken } from '../auth/sessionFromToken';
import type { Identity } from '../auth/identity';
import { createLogger } from '../log';
import { isHttpError } from '../http/errors';
import { InMemoryStore } from './fakes';
import { settle } from '@buxa/domain';

const EMAIL = 'maya.camp@example.test';
const identity = (authId: string, email = EMAIL): Identity => ({ authId, email, name: 'Maya' });

function capture() {
  const lines: string[] = [];

  return { lines, log: createLogger('info', line => lines.push(line)), text: () => lines.join('\n') };
}

describe('a conflicting identity (audit S-09)', () => {
  it('answers the client with a generic 409, and the server log has the detail but never the email', async () => {
    const store = new InMemoryStore();
    const users = store.asRepositories().users;
    await users.upsertFromIdentity(identity('auth-first'));

    const { log, text, lines } = capture();
    const attempt = sessionFromToken('token', { verifier: () => settle(() => identity('auth-second')), users }, log);
    const error: unknown = await attempt.catch((e: unknown) => e);

    expect(isHttpError(error)).toBe(true);
    if (!isHttpError(error)) {
      throw new Error('expected an HTTP error');
    }
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe(ACCOUNT_CONFLICT_MESSAGE);
    expect(error.message).not.toMatch(/email|already linked|different account/i);

    expect(text()).toContain('email-in-use');
    expect(text()).toContain('already linked to a different account'); // the detail, for the server
    expect(text()).not.toContain(EMAIL);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('a rejected token is logged by error name only, without the token text', async () => {
    const store = new InMemoryStore();
    const { log, text } = capture();
    const verifier = () => {
      return settle(() => {
        throw Object.assign(new Error(`bad signature for ${EMAIL} token eyJsecret`), { name: 'JWTExpired' });
      });
    };
    await expect(
      sessionFromToken('eyJsecret', { verifier, users: store.asRepositories().users }, log),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(text()).toContain('JWTExpired');
    expect(text()).not.toContain(EMAIL);
    expect(text()).not.toContain('eyJsecret');
  });
});
