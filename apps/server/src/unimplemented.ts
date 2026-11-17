/**
 * A placeholder for something not built yet: every method throws a clear error naming what is missing. It keeps the application
 * typed and starting while chunks land; nothing in a release may use it (a test greps for it once phase 1 is done).
 */
export function unimplemented<T extends object>(name: string): T {
  return new Proxy({}, {
    get: (_target, method) => () => { throw new Error(`${name}.${String(method)} is not implemented yet`); },
  }) as T;
}
