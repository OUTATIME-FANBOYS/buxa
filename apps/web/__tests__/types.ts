import { z } from 'zod';

/*
 * Reply shapes the integration tests read beyond what @buxa/contracts already describes. A test reads a JSON reply
 * through one of these schemas (or a contract's schema), so the field it uses is typed, and a changed reply fails
 * with a parse error rather than passing on a guess.
 */

/** A created record, answered with its id. */
export const IdBody = z.object({ id: z.string() });

/** A record answered with its name, such as a renamed camp. */
export const NameBody = z.object({ name: z.string() });
