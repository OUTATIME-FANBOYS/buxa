/** A posted form from plain values; an array becomes a repeated field (checkboxes). */
export function formOf(values: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) form.append(name, item);
  }
  return form;
}

export const IDS = {
  cls: '44444444-4444-4444-8444-444444444444',
  session: '55555555-5555-4555-8555-555555555555',
  camper: '66666666-6666-4666-8666-666666666666',
  enrolment: '77777777-7777-4777-8777-777777777777',
  instructor: '88888888-8888-4888-8888-888888888888',
} as const;
