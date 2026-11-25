/**
 * The emergency contact on a person: a name and a phone, with an optional relationship. Optional for everyone and not required
 * anywhere yet; it becomes a check when a profile is activated (see docs/phases/03-registration.md).
 */
export interface EmergencyContactFields {
  name: string | null;
  phone: string | null;
  relationship: string | null;
}

/** What a person view carries. `null` means this viewer may not see the contact at all (not the same as "none recorded"). */
export interface PersonWithEmergencyContact {
  emergencyContact: EmergencyContactFields | null;
}

const filled = (value: string | null): boolean => value !== null && value.trim() !== '';

/**
 * True when the person has a name and a phone for the emergency contact. Used only to show a muted note on the person page for a
 * camper; nothing is blocked by it. A contact the viewer may not see is `null`, so this is false for them, and the caller must check
 * visibility before it shows anything.
 */
export function emergencyContactComplete(person: PersonWithEmergencyContact): boolean {
  return (
    person.emergencyContact !== null && filled(person.emergencyContact.name) && filled(person.emergencyContact.phone)
  );
}
