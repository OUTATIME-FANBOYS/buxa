import { CAMP_ROLES, CAMP_ROLE_LABELS, isRoleAvailable, type CampRole } from '@buxa/domain';
import { ROLE_GROUPS } from './roleGroups';

/**
 * The Roles fieldset, the same in Add and Edit: checkboxes in two headed groups. A person holds only an allowed role set, so a box
 * that would make a set that is not allowed is disabled, with a short line that says why (one staff role at a time). A saved set that
 * is not allowed (legacy data) is shown as it is, with `notice` under the boxes, and nothing is disabled until it is fixed.
 */
export function PersonRoles({
  selected,
  onToggle,
  error,
  notice,
}: {
  selected: ReadonlySet<CampRole>;
  onToggle: (role: CampRole) => void;
  error?: string;
  notice?: string;
}) {
  const chosen = [...selected];
  const someDisabled = CAMP_ROLES.some(role => !isRoleAvailable(chosen, role));

  return (
    <fieldset className="plain person-section buxa:border-0 buxa:p-0 buxa:m-0 buxa:min-w-0 buxa:grid buxa:gap-[var(--s4)]">
      <legend className="person-legend">
        Roles
        <span className="field-required" aria-hidden="true">
          {' *'}
        </span>
      </legend>
      <p className="person-helper">Choose everything that applies.</p>
      {someDisabled && (
        <p className="person-helper" role="status">
          Some roles can&apos;t be combined. Greyed-out roles don&apos;t fit with what is ticked.
        </p>
      )}
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
                  disabled={!isRoleAvailable(chosen, option)}
                  onChange={() => onToggle(option)}
                />
                <span>{CAMP_ROLE_LABELS[option]}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {notice && (
        <p className="person-helper" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="field-error buxa:text-[length:var(--fs-s)] buxa:text-[var(--crit)]" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
