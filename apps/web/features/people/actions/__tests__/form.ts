/** A posted form from plain values; an array becomes a repeated field (checkboxes). */
export function formOf(values: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) form.append(name, item);
  }
  return form;
}

export const IDS = {
  person: '22222222-2222-4222-8222-222222222222',
  other: '44444444-4444-4444-8444-444444444444',
  household: '11111111-1111-4111-8111-111111111111',
  membership: '33333333-3333-4333-8333-333333333333',
} as const;
