/** An organisation's address: 3-50 characters, lowercase letters, digits and dashes, never starting or ending with a dash. Mirrors the database check. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
export const SLUG_HINT = 'Use 3–50 lowercase letters, numbers or dashes.';

export const isSlug = (value: string): boolean => SLUG_PATTERN.test(value);

/** "Sunrise Lake Camp!" → "sunrise-lake-camp". Returns '' when no valid address can be made from the name. */
export function suggestSlug(name: string): string {
  const slug = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/g, '');
  return isSlug(slug) ? slug : '';
}
