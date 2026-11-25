import { TextField } from '@/components/atoms';

/**
 * The Emergency contact section of the Add person form, for a camper. Optional at creation: blank name and phone save no contact.
 * The fields are named apart from the person's own phone (`emergencyContactPhone`), and the action reads them under those names.
 * It is edited later on the person's page, so it is not in the Edit form.
 */
export function EmergencyContactFields({ err }: { err: (name: string) => string | undefined }) {
  return (
    <fieldset className="plain person-section buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s4)]">
      <legend className="person-legend">Emergency contact</legend>
      <p className="person-helper">Optional for now. You can add or change it later on the camper&apos;s page.</p>
      <TextField
        label="Emergency contact name"
        name="emergencyContactName"
        error={err('emergencyContactName')}
        autoComplete="off"
        maxLength={120}
      />
      <TextField
        label="Emergency contact phone"
        type="tel"
        name="emergencyContactPhone"
        error={err('emergencyContactPhone')}
        autoComplete="off"
        maxLength={32}
      />
      <TextField
        label="Relationship"
        name="emergencyContactRelationship"
        error={err('emergencyContactRelationship')}
        hint="For example: mother, grandparent, neighbour."
        autoComplete="off"
        maxLength={40}
      />
    </fieldset>
  );
}
