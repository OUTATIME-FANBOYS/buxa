import { describe, expect, it } from 'vitest';
import { DEFAULT_RUNS, parseMeasureOptions } from './options';

const TOKEN = 'bx1.AAAAAAAAAAAAAAAAAAAAAA';
const LOCAL = ['--url', 'http://localhost:3000', '--token', TOKEN];

describe('parseMeasureOptions', () => {
  it('reads a local run with the defaults', () => {
    const options = parseMeasureOptions(LOCAL, {});
    expect(options.url.origin).toBe('http://localhost:3000');
    expect(options.token).toBe(TOKEN);
    expect(options.runs).toBe(DEFAULT_RUNS);
    expect(options.allowRemote).toBe(false);
    expect(options.actionId).toBeNull();
    expect(options.sessionCookie).toBeNull();
  });

  it('accepts --name=value forms and --runs', () => {
    const options = parseMeasureOptions([`--url=http://127.0.0.1:3000`, `--token=${TOKEN}`, '--runs=25'], {});
    expect(options.runs).toBe(25);
    expect(options.url.hostname).toBe('127.0.0.1');
  });

  it('refuses a remote site unless --allow-remote is given', () => {
    const remote = ['--url', 'https://buxa.example.org', '--token', TOKEN];
    expect(() => parseMeasureOptions(remote, {})).toThrow(/--allow-remote/);
    expect(parseMeasureOptions([...remote, '--allow-remote'], {}).allowRemote).toBe(true);
  });

  it('reads the session cookie from the environment and trims it', () => {
    expect(parseMeasureOptions(LOCAL, { BUXA_SESSION_COOKIE: '  sb-abc=1  ' }).sessionCookie).toBe('sb-abc=1');
    expect(parseMeasureOptions(LOCAL, { BUXA_SESSION_COOKIE: '   ' }).sessionCookie).toBeNull();
  });

  it('refuses a token that is not a Buxa badge, without echoing it', () => {
    try {
      parseMeasureOptions(['--url', 'http://localhost:3000', '--token', 'not-a-badge-123'], {});
      throw new Error('expected a refusal');
    } catch (error) {
      expect((error as Error).message).toMatch(/bx1\./);
      expect((error as Error).message).not.toContain('not-a-badge-123');
    }
  });

  it('requires --url and --token', () => {
    expect(() => parseMeasureOptions(['--token', TOKEN], {})).toThrow(/--url/);
    expect(() => parseMeasureOptions(['--url', 'http://localhost:3000'], {})).toThrow(/--token/);
  });

  it('refuses a missing value, an unknown option and a bad run count', () => {
    expect(() => parseMeasureOptions(['--url', '--token', TOKEN], {})).toThrow(/needs a value/);
    expect(() => parseMeasureOptions([...LOCAL, '--cookie', 'x'], {})).toThrow(/Unknown option --cookie/);
    expect(() => parseMeasureOptions([...LOCAL, '--runs', '0'], {})).toThrow(/--runs/);
    expect(() => parseMeasureOptions([...LOCAL, '--runs', '1000'], {})).toThrow(/--runs/);
    expect(() => parseMeasureOptions([...LOCAL, '--runs', '2.5'], {})).toThrow(/--runs/);
  });

  it('checks a hand-given action id', () => {
    expect(parseMeasureOptions([...LOCAL, '--action-id', 'a'.repeat(40)], {}).actionId).toBe('a'.repeat(40));
    expect(() => parseMeasureOptions([...LOCAL, '--action-id', 'not hex'], {})).toThrow(/--action-id/);
  });
});
