import type { HouseholdChoice } from '@buxa/shared';
import type { EditablePerson } from '@/components/components/people/forms';

export const LEE: HouseholdChoice = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Lee family',
  hasGuardian: true,
};

export const PERSON: EditablePerson = {
  id: '22222222-2222-4222-8222-222222222222',
  givenName: 'Ada',
  familyName: 'Lee',
  preferredName: null,
  roles: [],
  dateOfBirth: null,
  email: null,
  phone: null,
  households: [],
};

/** The form's DOM helpers, shared by the PersonForm tests. */
export const formHelpers = (host: () => HTMLElement) => ({
  role: (value: string) => host().querySelector<HTMLInputElement>(`input[name="roles"][value="${value}"]`),
  checkedRoles: () =>
    Array.from(host().querySelectorAll<HTMLInputElement>('input[name="roles"]'))
      .filter(input => input.checked)
      .map(input => input.value),
  legend: (text: string) => Array.from(host().querySelectorAll('legend')).find(l => l.textContent?.trim() === text),
  input: (name: string) => host().querySelector<HTMLInputElement>(`input[name="${name}"]`),
  select: (name: string) => host().querySelector<HTMLSelectElement>(`select[name="${name}"]`),
  label: (text: string) => Array.from(host().querySelectorAll('label')).find(l => l.textContent?.includes(text)),
});
