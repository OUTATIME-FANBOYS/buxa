/**
 * A state-free same-origin check for Route Handlers that accept a POST. Browsers send an Origin header on every cross-site POST, so a
 * POST whose Origin is not this app's own origin, or that carries no Origin at all, comes from another site or a non-browser client
 * and is refused before its body is read. (Server Actions already do this check; Route Handlers do not.)
 */
export function isSameOriginPost(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return false;
  }

  let own: string;
  try {
    own = new URL(request.url).origin;
  } catch {
    return false;
  }

  return origin === own;
}
