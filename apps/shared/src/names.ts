/** The first word of a full name: "Maya Chen" -> "Maya". Used wherever a name is shown without the surname. */
export const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? '';

/** The full name from a first and last name, with no stray spaces: ("Maya", "Chen") -> "Maya Chen", ("Maya", null) -> "Maya". */
export const fullNameOf = (firstName: string, lastName: string | null | undefined): string =>
  [firstName.trim(), (lastName ?? '').trim()].filter(Boolean).join(' ');
