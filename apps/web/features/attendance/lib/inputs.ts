import { z } from 'zod';

/** A code as the scanner or camera read it. Whatever it is, the credential service decides whether it means anyone. */
export const ScanInputSchema = z.object({ raw: z.string().max(500) });

/** A name typed into the search box. Empty is allowed: it means "show nothing yet". */
export const SearchInputSchema = z.object({ query: z.string().trim().max(80) });
