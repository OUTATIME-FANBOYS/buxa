import { describe, expect, it } from 'vitest';
import { createLogger } from '../log';

const capture = (level: Parameters<typeof createLogger>[0]) => { const lines: Record<string, unknown>[] = []; return { lines, log: createLogger(level, l => lines.push(JSON.parse(l))) }; };

describe('logger', () => {
  it('writes one JSON object per line with level, time and message', () => {
    const { log, lines } = capture('info');
    log.info({ path: '/x' }, 'hello');
    expect(lines).toEqual([expect.objectContaining({ level: 30, msg: 'hello', path: '/x', time: expect.any(Number) })]);
  });
  it('accepts a plain message', () => { const { log, lines } = capture('info'); log.warn('careful'); expect(lines[0]).toMatchObject({ level: 40, msg: 'careful' }); });
  it('drops anything below the configured level, and everything when silent', () => {
    const a = capture('warn'); a.log.info('no'); a.log.error('yes'); expect(a.lines.map(l => l.msg)).toEqual(['yes']);
    const b = capture('silent'); b.log.fatal('never'); expect(b.lines).toEqual([]);
  });
  it('writes errors out with type, message and stack', () => {
    const { log, lines } = capture('error');
    log.error({ err: new TypeError('bad thing') }, 'failed');
    expect(lines[0].err).toMatchObject({ type: 'TypeError', message: 'bad thing', stack: expect.stringContaining('bad thing') });
  });
  it('a child adds its fields to every line without changing the parent', () => {
    const { log, lines } = capture('info');
    log.child({ reqId: 'r-1' }).info('inside'); log.info('outside');
    expect(lines[0]).toMatchObject({ reqId: 'r-1' }); expect(lines[1]).not.toHaveProperty('reqId');
  });
});
