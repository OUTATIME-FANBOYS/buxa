/**
 * What an attendance Server Action hands back. An expected business outcome (a refused check-in, say) is a value inside `ok`, so the
 * screen can show it; `forbidden` and `invalid` are the two problems a person can cause. Anything else throws to the error boundary.
 */
export type ActionOutcome<R> =
  | { kind: 'ok'; value: R }
  | { kind: 'forbidden'; message: string }
  | { kind: 'invalid'; message: string };
