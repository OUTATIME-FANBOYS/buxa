export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
const SEVERITY: Record<LogLevel, number> = {
  silent: 0,
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};

export interface Logger {
  fatal(fields: object | string, message?: string): void;
  error(fields: object | string, message?: string): void;
  warn(fields: object | string, message?: string): void;
  info(fields: object | string, message?: string): void;
  debug(fields: object | string, message?: string): void;
  /** A logger that adds these fields to every line (for example the request id). */
  child(fields: object): Logger;
}

type Write = (line: string) => void;

/** The name of an error, safe to log: never its message, which can echo a token or an address. */
export const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'unknown');

/** Errors do not survive JSON.stringify, so they are written out by hand. */
const serialise = <T>(value: T): T | { type: string; message: string; stack: string | undefined } =>
  value instanceof Error ? { type: value.name, message: value.message, stack: value.stack } : value;

/**
 * One JSON object per line on stdout, which is what log collectors expect. Only what a caller passes is written:
 * never headers, cookies, tokens or query strings, because nothing here reads them.
 */
export function createLogger(
  level: LogLevel,
  write: Write = line => process.stdout.write(`${line}\n`),
  bindings: object = {},
): Logger {
  const emit =
    (name: Exclude<LogLevel, 'silent'>) =>
    (fields: object | string, message?: string): void => {
      if (SEVERITY[name] < SEVERITY[level] || level === 'silent') {
        return;
      }
      const extra =
        typeof fields === 'string' ? {} : Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, serialise(v)]));
      write(
        JSON.stringify({
          level: SEVERITY[name],
          time: Date.now(),
          ...bindings,
          ...extra,
          msg: typeof fields === 'string' ? fields : message,
        }),
      );
    };

  return {
    fatal: emit('fatal'),
    error: emit('error'),
    warn: emit('warn'),
    info: emit('info'),
    debug: emit('debug'),
    child: fields => createLogger(level, write, { ...bindings, ...fields }),
  };
}
