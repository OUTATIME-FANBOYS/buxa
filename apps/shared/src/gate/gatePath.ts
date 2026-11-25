/** The path of a camp's check-in link. The token is random; the page is public (no sign-in). */
export const gatePath = (token: string): string => `/gate/${token}`;
