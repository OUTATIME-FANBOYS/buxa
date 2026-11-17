/**
 * The id Next.js gives the scan Server Action. The production client bundle names each action next to its id, for example
 * `createServerReference("<40+ hex digits>", callServer, ..., "scanCodeAction")`, so the id is read from the page's scripts.
 * Returns null when the bundle does not name the action (a changed build, or a minified name), and the operator passes --action-id.
 */
export function findScanActionId(bundleSource: string): string | null {
  const match = /"([0-9a-f]{40,})"[^"]{0,160}"scanCodeAction"/.exec(bundleSource);
  return match ? match[1] : null;
}
