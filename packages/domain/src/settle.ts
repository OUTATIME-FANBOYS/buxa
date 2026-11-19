/**
 * Runs `run` now, synchronously, and returns a promise for its outcome: resolved with
 * the return value, or rejected with whatever it threw. Use it where a function must
 * keep returning a Promise (and keep rejecting rather than throwing) but has no await.
 */
export function settle<T>(run: () => T | PromiseLike<T>): Promise<T> {
  return new Promise<T>(resolve => {
    resolve(run());
  });
}
