/** Up to two capital letters from a display name: "Maya Chen" -> "MC". */
export const initials = (name: string) => name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
