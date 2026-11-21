import type { CampRole } from '@buxa/domain';
import { CAMP_ROLE_LABELS } from '@buxa/domain';
import { ROLE_GROUPS } from './roleGroups';

/**
 * The Roles fieldset, the same in Add and Edit: checkboxes in two headed groups. A person holds any number of roles, so every role
 * is a checkbox and the selection is owned by the form.
 */
export function PersonRoles({
  selected,
  onToggle,
  error,
}: {
  selected: ReadonlySet<CampRole>;
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
      <p className="person-helper">Choose everything that applies.</p>
      {ROLE_GROUPS.map(group => (
        <div key={group.heading} className="person-role-group">
          <h3 className="person-role-heading">{group.heading}</h3>
          <div className="people-checks">
            {group.roles.map(option => (
              <label key={option} className="people-check">
                <input
                  type="checkbox"
                  name="roles"
                  value={option}
                  checked={selected.has(option)}
                  onChange={() => onToggle(option)}
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
