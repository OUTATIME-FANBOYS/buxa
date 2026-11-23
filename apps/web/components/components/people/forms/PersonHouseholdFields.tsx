import { HiddenField, Select, TextField } from '@/components/atoms';
import { ADD_PERSON_INTRO, householdChoiceLabel, type HouseholdChoice } from '@buxa/shared';

/** A household the person is joining that the form already knows (from a guardian's page). */
export interface HouseholdTarget {
  id: string;
  name: string;
}

/**
 * The Household section, the same in Add and Edit. It shows for a family role. A child joins a household with a parent or guardian in
 * it; the server checks that. `household` is set when the person comes from a guardian's page, so they join that one household.
 * `choices` are the camp's households, and `defaultHouseholdId` pre-selects the person's own household when editing.
 */
export function PersonHouseholdFields({
  household,
  choices,
  defaultHouseholdId,
  showRelationship,
  defaultRelationship,
  err,
}: {
  household: HouseholdTarget | null;
  choices: readonly HouseholdChoice[];
  defaultHouseholdId: string;
  showRelationship: boolean;
  defaultRelationship?: string;
  err: (name: string) => string | undefined;
}) {
  return (
    <fieldset className="plain person-section buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s4)]">
      <legend className="person-legend">Household</legend>
      <p className="person-helper">{ADD_PERSON_INTRO}</p>
      {household ? (
        <>
          <HiddenField name="householdId" value={household.id} />
          <p>
            This person joins the <strong>{household.name}</strong> household.
          </p>
        </>
      ) : (
        <>
          {choices.length > 0 && (
            <Select
              label="Existing household"
              name="householdId"
              defaultValue={defaultHouseholdId}
              error={err('householdId')}
              hint="Join a household already in the camp. A child needs one with a parent or guardian in it."
              options={[
                { value: '', label: 'Not an existing household' },
                ...choices.map(h => ({ value: h.id, label: householdChoiceLabel(h) })),
              ]}
            />
          )}
          <TextField
            label="New household name"
            name="newHouseholdName"
            error={err('newHouseholdName') ?? (choices.length === 0 ? err('householdId') : undefined)}
            autoComplete="off"
            maxLength={120}
          />
        </>
      )}
      {showRelationship && (
        <TextField
          label="How they are related"
          name="relationship"
          defaultValue={defaultRelationship}
          error={err('relationship')}
          hint="For example: son, daughter, mother, father. Needed when they join a household."
          autoComplete="off"
          maxLength={40}
        />
      )}
      {household && err('householdId') && (
        <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {err('householdId')}
        </p>
      )}
    </fieldset>
  );
}
