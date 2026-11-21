import type { CampRole } from '@buxa/domain';
import { CAMP_ROLE_LABELS } from '@buxa/domain';
import { ROLE_GROUPS } from './roleGroups';

/**
 * The Roles fieldset, the same in Add and Edit: one role at a time, as radios in two headed groups. Selecting the chosen role again
 * clears it, so a role is required again. The selection is owned by the form.
 */
export function PersonRoles({
  selected,
  onToggle,
  error,
}: {
  selected: CampRole | null;
  onToggle: (role: CampRole) => void;
  error?: string;
}) {
  return (
    <fieldset className="plain person-section buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s4)]">
      <legend className="person-legend">
        Roles
        <span className="field-required" aria-hidden="true">
          {' *'}
        </span>
      </legend>
      <p className="person-helper">Choose one. Select it again to clear it.</p>
      {ROLE_GROUPS.map(group => (
        <div key={group.heading} className="person-role-group">
          <h3 className="person-role-heading">{group.heading}</h3>
          <div className="people-checks">
            {group.roles.map(option => (
              <label key={option} className="people-check">
                <input
                  type="radio"
                  name="roles"
                  value={option}
                  checked={selected === option}
                  onChange={() => undefined}
                  onClick={() => onToggle(option)}
                />
                <span>{CAMP_ROLE_LABELS[option]}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {error && (
        <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
