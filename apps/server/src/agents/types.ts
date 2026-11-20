import { z } from 'zod';
import { isData, type Data } from '@buxa/shared';

/*
 * Shapes of the agent server's replies, as the tests read them. The HTTP bodies and the MCP tool results arrive as
 * unknown JSON; each test parses the body with one of these schemas before it reads a field, so a changed reply fails
 * the test with a parse error instead of passing on a guess.
 */

/** GET and PUT /api/state: the shared copy of the data and the version it is at. */
export const StateBody = z.object({
  version: z.number(),
  empty: z.boolean().optional(),
  data: z.custom<Data>(isData).optional(),
});

/** A PUT /api/state reply. A 409 answer also carries the current version. */
export const VersionBody = z.object({ version: z.number().optional() });

/** POST /api/agents/:id/token. */
export const TokenBody = z.object({ token: z.string() });

/** The whoami tool: who the agent is, what it may do, and the projects it can reach. */
export const WhoAmIBody = z.object({
  name: z.string(),
  permissions: z.record(z.string(), z.string()),
  projects: z.array(z.object({ id: z.string(), name: z.string() })),
});

/** The result of a write tool: applied at once, or queued as a proposal for a person to decide. Ids are null when not set. */
export const OutcomeBody = z.object({
  status: z.string(),
  taskId: z.string().nullish(),
  proposalId: z.string().nullish(),
});

/** The list_my_proposals tool: each entry has at least an id. */
export const ProposalListBody = z.array(z.object({ id: z.string() }));
