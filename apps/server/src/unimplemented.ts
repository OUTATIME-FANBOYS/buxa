/**
 * A placeholder for something not built yet: every method throws a clear error naming what is missing. It keeps the application
 * typed and starting while work lands; nothing in a release may use it (the noPlaceholders test fails if any call remains).
 */
export function unimplemented<T extends object>(name: string): T {
  return new Proxy({}, {
    get: (_target, method) => () => {
      throw new Error(`${name}.${String(method)} is not implemented yet`);
    },
  }) as T;
}
