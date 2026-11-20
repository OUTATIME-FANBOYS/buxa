import { describe, expect, it } from 'vitest';
import { isAcceptedFailure, noDatabaseDeclared } from '../scripts/smoke-rules';

const PUBLIC = {
  url: '/camps/00000000-0000-0000-0000-000000000001/sessions/00000000-0000-0000-0000-000000000001',
  file: 'camps/[slug]/sessions/[sessionId]/page.tsx',
};
const OTHER = { url: '/camp/sessions', file: 'camp/(operations)/sessions/page.tsx' };

describe('smoke failures a job without a database may accept', () => {
  it('accepts the public session page answering 500 only when no database is declared', () => {
    expect(isAcceptedFailure({ ...PUBLIC, status: 500 }, true)).toBe(true);
    expect(isAcceptedFailure({ ...PUBLIC, status: 500 }, false)).toBe(false);
  });

  it('never accepts another route answering 500, even without a database', () => {
    expect(isAcceptedFailure({ ...OTHER, status: 500 }, true)).toBe(false);
  });

  it('keeps accepting /ready answering 503 with or without a declared database', () => {
    expect(isAcceptedFailure({ url: '/ready', file: 'ready/route.ts', status: 503 }, false)).toBe(true);
  });

  it('reads the declaration only when it is exactly 1', () => {
    expect(noDatabaseDeclared({ SMOKE_NO_DATABASE: '1' })).toBe(true);
    expect(noDatabaseDeclared({ SMOKE_NO_DATABASE: 'true' })).toBe(false);
    expect(noDatabaseDeclared({})).toBe(false);
  });
});
