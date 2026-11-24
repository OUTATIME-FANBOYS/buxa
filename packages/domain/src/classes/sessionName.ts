/*
 * Names that look alike are the same name. A session, group or room name is stored in its normalised form (normaliseName), and two
 * names clash when their keys (nameKey) are equal. The database index on each name uses the same rule in SQL
 * (buxa_name_key, migration 0056), so keep the two in step.
 */

/** The characters that look like a space but are not: non-breaking space, zero-width characters, the word joiner, the byte order mark and the ideographic space. */
const SPACE_LIKE = /[ ​‌‍⁠﻿　]/g;

/**
 * The name as it is stored: Unicode NFKC (full-width letters become plain letters), space-like characters turned into a space, runs
 * of white space collapsed to one, and the ends trimmed. Case is kept.
 */
export function normaliseName(name: string): string {
  return name.normalize('NFKC').replace(SPACE_LIKE, ' ').replace(/\s+/g, ' ').trim();
}

/** The form a name is compared in: the normalised name in lower case. "  Summer   2027 " and "summer 2027" are the same name. */
export function nameKey(name: string): string {
  return normaliseName(name).toLowerCase();
}

/** The same as nameKey, kept under its older name for session names. */
export const sessionNameKey = nameKey;
